import { db } from '@/lib/db'
import { orders, responses, messages } from '@/lib/schema'
import { eq, count } from 'drizzle-orm'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      client: { columns: { id: true, name: true, role: true, phone: true, avatar: true, lastSeenAt: true }, with: { profile: true } },
      executor: { columns: { id: true, name: true, role: true, phone: true, avatar: true, lastSeenAt: true }, with: { profile: true } },
      category: true,
      responses: {
        with: { executor: { columns: { id: true, name: true, role: true, avatar: true }, with: { profile: true } } },
        orderBy: (responses, { desc }) => [desc(responses.createdAt)],
      },
    },
  })

  if (!order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })

  // Get message count
  const [msgCount] = await db
    .select({ count: count() })
    .from(messages)
    .where(eq(messages.orderId, id))

  return NextResponse.json({ order: { ...order, _count: { messages: msgCount.count } } })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getTokenFromHeaders(req.headers) || (() => { const c = req.cookies.get('token'); return c?.value || null })()
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Токен истёк' }, { status: 401 })

  const { id } = await params
  const [order] = await db.select({ clientId: orders.clientId }).from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
  if (order.clientId !== payload.userId) return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

  try {
    const body = await req.json()
    const updateData: Record<string, unknown> = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.executorId !== undefined) updateData.executorId = body.executorId
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.budgetFrom !== undefined) updateData.budgetFrom = body.budgetFrom
    if (body.budgetTo !== undefined) updateData.budgetTo = body.budgetTo
    if (body.deadline !== undefined) updateData.deadline = body.deadline
    updateData.updatedAt = new Date().toISOString()

    await db.update(orders).set(updateData).where(eq(orders.id, id))

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}
