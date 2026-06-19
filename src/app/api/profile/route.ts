import { db } from '@/lib/db'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

// GET /api/profile — current user's profile
export async function GET(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers) || (() => { const c = req.cookies.get('token'); return c?.value || null })()
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Токен истёк' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: { profile: true },
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
      await db.user.update({ where: { id: payload.userId }, data: userData })
    }

    // Update profile
    const { name: _n, phone: _p, avatar: _a, ...profileData } = body
    // Only upsert if there are profile fields to update
    if (Object.keys(profileData).length > 0) {
      await db.profile.upsert({
        where: { userId: payload.userId },
        create: { userId: payload.userId, specializations: '[]', ...profileData },
        update: profileData as Record<string, unknown>,
      })
    }

    const user = await db.user.findUnique({ where: { id: payload.userId }, include: { profile: true } })
    return NextResponse.json({ user: { id: user!.id, name: user!.name, email: user!.email, role: user!.role, phone: user!.phone, avatar: user!.avatar, profile: user!.profile } })
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}
