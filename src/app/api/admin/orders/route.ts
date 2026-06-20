import { db } from '@/lib/db'
import { orders, users, responses, messages } from '@/lib/schema'
import { eq, inArray, sql, count } from 'drizzle-orm'
import { getTokenFromHeaders, verifyToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

async function requireAdmin(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return null
  return payload
}

// GET /api/admin/orders — list all orders (paginated)
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')))
    const offset = (page - 1) * limit

    const [total] = await db.select({ value: count() }).from(orders)

    const allOrders = await db
      .select({
        id: orders.id,
        title: orders.title,
        status: orders.status,
        clientId: orders.clientId,
        executorId: orders.executorId,
        budgetFrom: orders.budgetFrom,
        budgetTo: orders.budgetTo,
        region: orders.region,
        city: orders.city,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(sql`${orders.createdAt} DESC`)
      .limit(limit)
      .offset(offset)

    // Get client and executor names
    const userIds = new Set<string>()
    allOrders.forEach(o => {
      userIds.add(o.clientId)
      if (o.executorId) userIds.add(o.executorId)
    })

    const userMap: Record<string, string> = {}
    if (userIds.size > 0) {
      const userRows = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(sql`${users.id} IN (${sql.join([...userIds].map(id => sql`${id}`), sql`, `)})`)
      userRows.forEach(u => { userMap[u.id] = u.name })
    }

    const ordersWithNames = allOrders.map(o => ({
      ...o,
      clientName: userMap[o.clientId] || 'Неизвестно',
      executorName: o.executorId ? (userMap[o.executorId] || 'Неизвестно') : null,
    }))

    return NextResponse.json({
      orders: ordersWithNames,
      pagination: {
        page,
        limit,
        total: total.value,
        totalPages: Math.ceil(total.value / limit),
      },
    })
  } catch (e) {
    console.error('Admin orders list error:', e)
    return NextResponse.json({ error: 'Ошибка загрузки заказов' }, { status: 500 })
  }
}