import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { verifyToken, signToken, getTokenFromHeaders } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // Try Authorization header first, then cookie
  const token = getTokenFromHeaders(req.headers) || (() => { const c = req.cookies.get('token'); return c?.value || null })()
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Токен истёк' }, { status: 401 })

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.userId),
    with: { profile: true },
  })
  if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })

  // Issue a fresh token so Zustand always has a valid one
  const freshToken = await signToken({ userId: user.id, email: user.email, role: user.role })

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone, avatar: user.avatar, profile: user.profile },
    token: freshToken,
  })
}
