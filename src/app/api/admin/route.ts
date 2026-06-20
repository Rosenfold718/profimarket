import { db } from '@/lib/db'
import { users, orders, messages, responses, profiles, conversations } from '@/lib/schema'
import { eq, sql, count, and } from 'drizzle-orm'
import { getTokenFromHeaders, verifyToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

async function requireAdmin(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return null
  return payload
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })

    const [totalUsers] = await db.select({ value: count() }).from(users)
    const [clients] = await db.select({ value: count() }).from(users).where(eq(users.role, 'CLIENT'))
    const [executors] = await db.select({ value: count() }).from(users).where(eq(users.role, 'EXECUTOR'))
    const [admins] = await db.select({ value: count() }).from(users).where(eq(users.role, 'ADMIN'))
    const [totalOrders] = await db.select({ value: count() }).from(orders)
    const [openOrders] = await db.select({ value: count() }).from(orders).where(eq(orders.status, 'OPEN'))
    const [inProgressOrders] = await db.select({ value: count() }).from(orders).where(eq(orders.status, 'IN_PROGRESS'))
    const [completedOrders] = await db.select({ value: count() }).from(orders).where(eq(orders.status, 'COMPLETED'))
    const [cancelledOrders] = await db.select({ value: count() }).from(orders).where(eq(orders.status, 'CANCELLED'))
    const [totalMessages] = await db.select({ value: count() }).from(messages)
    const [totalResponses] = await db.select({ value: count() }).from(responses)
    const [totalConversations] = await db.select({ value: count() }).from(conversations)

    return NextResponse.json({
      users: {
        total: totalUsers.value,
        clients: clients.value,
        executors: executors.value,
        admins: admins.value,
      },
      orders: {
        total: totalOrders.value,
        open: openOrders.value,
        inProgress: inProgressOrders.value,
        completed: completedOrders.value,
        cancelled: cancelledOrders.value,
      },
      messages: { total: totalMessages.value },
      responses: { total: totalResponses.value },
      conversations: { total: totalConversations.value },
    })
  } catch (e) {
    console.error('Admin stats error:', e)
    return NextResponse.json({ error: 'Ошибка загрузки статистики' }, { status: 500 })
  }
}