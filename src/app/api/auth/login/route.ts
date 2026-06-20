import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { signToken, verifyPassword } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

const schema = z.object({
  email: z.email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = schema.parse(body)

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      with: { profile: true },
    })
    if (!user) return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 })

    const token = await signToken({ userId: user.id, email: user.email, role: user.role })
    const res = NextResponse.json({
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone,
        profile: user.profile,
      },
      token,
    })
    res.cookies.set('token', token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 604800, path: '/' })
    return res
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Ошибка входа' }, { status: 500 })
  }
}
