import { db } from '@/lib/db'
import { users, profiles } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { trackActivity } from '@/lib/track'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { randomUUID } from 'crypto'

// GET /api/profile — current user's profile
export async function GET(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers) || (() => { const c = req.cookies.get('token'); return c?.value || null })()
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Токен истёк' }, { status: 401 })

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.userId),
    with: { profile: true },
  })
  if (!user) return NextResponse.json({ error: 'Не найден' }, { status: 404 })

  return NextResponse.json({ profile: user.profile, user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, avatar: user.avatar } })
}

// PUT /api/profile — update profile
export async function PUT(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers) || (() => { const c = req.cookies.get('token'); return c?.value || null })()
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Токен истёк' }, { status: 401 })

  const schema = z.object({
    name: z.string().min(2).optional(),
    phone: z.string().optional(),
    avatar: z.string().optional(),
    company: z.string().optional(),
    position: z.string().optional(),
    experienceYears: z.number().int().min(0).optional(),
    specializations: z.string().optional(),
    description: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
    education: z.string().optional(),
    certificates: z.string().optional(),
    website: z.string().optional(),
  })

  try {
    const body = schema.parse(await req.json())

    // Update user name/phone/avatar
    const userData: Record<string, string | null> = {}
    if (body.name) userData.name = body.name
    if (body.phone !== undefined) userData.phone = body.phone
    if (body.avatar !== undefined) userData.avatar = body.avatar

    if (Object.keys(userData).length > 0) {
      userData.updatedAt = new Date().toISOString()
      await db.update(users).set(userData).where(eq(users.id, payload.userId))
    }

    // Update profile using upsert pattern
    const { name: _n, phone: _p, avatar: _a, ...profileData } = body
    if (Object.keys(profileData).length > 0) {
      const existingProfile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, payload.userId),
      })

      if (existingProfile) {
        await db.update(profiles).set(profileData as Record<string, unknown>).where(eq(profiles.userId, payload.userId))
      } else {
        await db.insert(profiles).values({
          id: randomUUID(),
          userId: payload.userId,
          specializations: (profileData as Record<string, unknown>).specializations as string || '[]',
          ...profileData,
        })
      }
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
      with: { profile: true },
    })

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    trackActivity(payload.userId, 'update_profile', { fields: Object.keys(body) }, ip)

    return NextResponse.json({ user: { id: user!.id, name: user!.name, email: user!.email, role: user!.role, phone: user!.phone, avatar: user!.avatar, profile: user!.profile } })
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}
