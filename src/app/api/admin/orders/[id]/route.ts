import { db } from '@/lib/db'
import { orders, responses, messages } from '@/lib/schema'
import { eq, inArray, and } from 'drizzle-orm'
import { getTokenFromHeaders, verifyToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

async function requireAdmin(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return null
  return payload
}

// DELETE /api/admin/orders/[id] — delete an order and all its responses & messages
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })

    const { id: orderId } = await params

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    })
    if (!order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })

    // 1. Delete all responses for this order
    await db.delete(responses).where(eq(responses.orderId, orderId))

    // 2. Delete all messages for this order
    await db.delete(messages).where(eq(messages.orderId, orderId))

    // 3. Delete the order
    await db.delete(orders).where(eq(orders.id, orderId))

    return NextResponse.json({ message: 'Заказ и все связанные данные удалены' })
  } catch (e) {
    console.error('Admin delete order error:', e)
    return NextResponse.json({ error: 'Ошибка удаления заказа' }, { status: 500 })
  }
}