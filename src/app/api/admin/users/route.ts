import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { getTokenFromHeaders, verifyToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { count, sql } from 'drizzle-orm'

async function requireAdmin(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return null
  return payload
}

// GET /api/admin/users — list all users (paginated)
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')))
    const search = url.searchParams.get('search') || ''
    const offset = (page - 1) * limit

    const whereCondition = search
      ? sql`${users.name} LIKE ${'%' + search + '%'} OR ${users.email} LIKE ${'%' + search + '%'}`
      : undefined

    const [total] = await db
      .select({ value: count() })
      .from(users)
      .where(whereCondition)

    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        phone: users.phone,
        avatar: users.avatar,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereCondition)
      .orderBy(sql`${users.createdAt} DESC`)
      .limit(limit)
      .offset(offset)

    return NextResponse.json({
      users: allUsers,
      pagination: {
        page,
        limit,
        total: total.value,
        totalPages: Math.ceil(total.value / limit),
      },
    })
  } catch (e) {
    console.error('Admin users list error:', e)
    return NextResponse.json({ error: 'Ошибка загрузки пользователей' }, { status: 500 })
  }
}