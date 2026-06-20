import { db } from '@/lib/db'
import { orders, messages } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { getTokenFromHeaders, verifyToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/orders/[id]/messages/[msgId] — delete a single message (own only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  const token = getTokenFromHeaders(_req.headers) || (() => { const c = _req.cookies.get('token'); return c?.value || null })()
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Токен истёк' }, { status: 401 })

  const { id, msgId } = await params

  // Verify order exists
  const order = await db.select({ clientId: orders.clientId, executorId: orders.executorId }).from(orders).where(eq(orders.id, id)).limit(1)
  if (!order.length) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })

  // Verify message belongs to this order
  const msg = await db.select().from(messages).where(eq(messages.id, msgId)).limit(1)
  if (!msg.length) return NextResponse.json({ error: 'Сообщение не найдено' }, { status: 404 })
  if (msg[0].orderId !== id) return NextResponse.json({ error: 'Не найдено' }, { status: 404 })

  try {
    await db.delete(messages).where(and(eq(messages.id, msgId), eq(messages.orderId, id)))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
  }
}