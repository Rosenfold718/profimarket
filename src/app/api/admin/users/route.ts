import { db } from '@/lib/db'
import { users, profiles, orders, responses, messages } from '@/lib/schema'
import { getTokenFromHeaders, verifyToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { count, sql, inArray, and, isNotNull } from 'drizzle-orm'

async function requireAdmin(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return null
  return payload
}

// GET /api/admin/users — list all users (paginated) with profile data and counts
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
        passwordHash: users.passwordHash,
        lastSeenAt: users.lastSeenAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereCondition)
      .orderBy(sql`${users.createdAt} DESC`)
      .limit(limit)
      .offset(offset)

    // Fetch profiles for all users
    const userIds = allUsers.map(u => u.id)
    let profileMap: Record<string, { company: string | null; city: string | null; rating: number; completedOrders: number; specializations: string }> = {}
    if (userIds.length > 0) {
      const userProfiles = await db
        .select({
          userId: profiles.userId,
          company: profiles.company,
          city: profiles.city,
          rating: profiles.rating,
          completedOrders: profiles.completedOrders,
          specializations: profiles.specializations,
        })
        .from(profiles)
      for (const p of userProfiles) {
        profileMap[p.userId] = p
      }
    }

    // Fetch counts for each user
    let clientOrderCounts: Record<string, number> = {}
    let executorOrderCounts: Record<string, number> = {}
    let responseCounts: Record<string, number> = {}
    let messageCounts: Record<string, number> = {}

    if (userIds.length > 0) {
      const coResults = await db
        .select({ clientId: orders.clientId, cnt: count() })
        .from(orders)
        .where(inArray(orders.clientId, userIds))
        .groupBy(orders.clientId)
      clientOrderCounts = Object.fromEntries(coResults.map(r => [r.clientId, r.cnt]))

      const eoResults = await db
        .select({ executorId: orders.executorId, cnt: count() })
        .from(orders)
        .where(and(inArray(orders.executorId, userIds), isNotNull(orders.executorId)))
        .groupBy(orders.executorId)
      executorOrderCounts = Object.fromEntries(eoResults.map(r => [r.executorId, r.cnt]))

      const respResults = await db
        .select({ executorId: responses.executorId, cnt: count() })
        .from(responses)
        .where(inArray(responses.executorId, userIds))
        .groupBy(responses.executorId)
      responseCounts = Object.fromEntries(respResults.map(r => [r.executorId, r.cnt]))

      const msgResults = await db
        .select({ senderId: messages.senderId, cnt: count() })
        .from(messages)
        .where(inArray(messages.senderId, userIds))
        .groupBy(messages.senderId)
      messageCounts = Object.fromEntries(msgResults.map(r => [r.senderId, r.cnt]))
    }

    const usersWithExtras = allUsers.map(u => {
      const prof = profileMap[u.id]
      return {
        ...u,
        profile: prof ? {
          company: prof.company,
          city: prof.city,
          rating: prof.rating,
          completedOrders: prof.completedOrders,
          specializations: prof.specializations,
        } : null,
        _count: {
          clientOrders: clientOrderCounts[u.id] || 0,
          executorOrders: executorOrderCounts[u.id] || 0,
          responses: responseCounts[u.id] || 0,
          sentMessages: messageCounts[u.id] || 0,
        },
      }
    })

    return NextResponse.json({
      users: usersWithExtras,
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