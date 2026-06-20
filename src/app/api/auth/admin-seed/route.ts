import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { hashPassword } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST() {
  try {
    const email = 'admin@profimarket.ru'
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (existing) {
      return NextResponse.json({ message: 'Admin already exists', user: { id: existing.id, email: existing.email, role: existing.role } })
    }

    const passwordHash = await hashPassword('Admin123!')
    const now = new Date().toISOString()
    const id = randomUUID()

    const [user] = await db.insert(users).values({
      id,
      email,
      passwordHash,
      name: 'Администратор',
      role: 'ADMIN',
      createdAt: now,
      updatedAt: now,
    }).returning()

    return NextResponse.json({ message: 'Admin created', user: { id: user.id, email: user.email, role: user.role, name: user.name } })
  } catch (e) {
    console.error('Admin seed error:', e)
    return NextResponse.json({ error: 'Failed to seed admin' }, { status: 500 })
  }
}