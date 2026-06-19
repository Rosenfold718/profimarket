'use server'
import { db } from '@/lib/db'
import { signToken, hashPassword } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

const schema = z.object({
  email: z.email('Некорректный email'),
  password: z.string().min(6, 'Минимум 6 символов'),
  name: z.string().min(2, 'Минимум 2 символа'),
  role: z.enum(['CLIENT', 'EXECUTOR']),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, name, role } = schema.parse(body)

    const exists = await db.user.findUnique({ where: { email } })
    if (exists) return NextResponse.json({ error: 'Этот email уже зарегистрирован' }, { status: 409 })

    const passwordHash = await hashPassword(password)
    const user = await db.user.create({ data: { email, passwordHash, name, role } })

    if (role === 'EXECUTOR') {
      await db.profile.create({ data: { userId: user.id, specializations: '[]' } })
    }

    const token = await signToken({ userId: user.id, email: user.email, role: user.role })
    const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token })
    res.cookies.set('token', token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 604800, path: '/' })
    return res
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0].message }, { status: 400 })
    console.error('Register error:', e)
    return NextResponse.json({ error: 'Ошибка регистрации' }, { status: 500 })
  }
}
