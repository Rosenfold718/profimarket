import { db } from '@/lib/db'
import { users, profiles, orders, responses, messages, conversations } from '@/lib/schema'
import { eq, inArray, or } from 'drizzle-orm'
import { getTokenFromHeaders, verifyToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

async function requireAdmin(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return null
  return payload
}

// DELETE /api/admin/users/[id] — delete a user and all related data
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })

    const { id: userId } = await params

    // Verify user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    })
    if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })

    // Don't allow deleting yourself
    if (user.email === admin.email) {
      return NextResponse.json({ error: 'Нельзя удалить свой аккаунт' }, { status: 400 })
    }

    // 1. Delete messages sent by this user (in conversations or orders)
    await db.delete(messages).where(eq(messages.senderId, userId))

    // 2. Get order IDs where user is client or executor
    const clientOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.clientId, userId))
    const executorOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.executorId, userId))

    const orderIds = [...clientOrders.map(o => o.id), ...executorOrders.map(o => o.id)]

    if (orderIds.length > 0) {
      // 3. Delete responses by this user on any orders
      await db.delete(responses).where(eq(responses.executorId, userId))

      // 4. Delete messages in those orders
      await db.delete(messages).where(inArray(messages.orderId, orderIds))

      // 5. Delete remaining responses in those orders
      await db.delete(responses).where(inArray(responses.orderId, orderIds))

      // 6. Delete the orders
      await db.delete(orders).where(inArray(orders.id, orderIds))
    }

    // 7. Delete conversations where user is participant
    await db.delete(conversations).where(
      or(eq(conversations.user1Id, userId), eq(conversations.user2Id, userId))
    )

    // 8. Delete profile
    await db.delete(profiles).where(eq(profiles.userId, userId))

    // 9. Delete user
    await db.delete(users).where(eq(users.id, userId))

    return NextResponse.json({ message: 'Пользователь и все связанные данные удалены' })
  } catch (e) {
    console.error('Admin delete user error:', e)
    return NextResponse.json({ error: 'Ошибка удаления пользователя' }, { status: 500 })
  }
}