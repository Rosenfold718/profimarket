import { db } from '@/lib/db'
import { responses, orders } from '@/lib/schema'
import { eq, and, desc } from 'drizzle-orm'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { randomUUID } from 'crypto'

// GET responses for an order
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const responsesList = await db.query.responses.findMany({
    where: eq(responses.orderId, id),
    with: { executor: { columns: { id: true, name: true, role: true }, with: { profile: true } } },
    orderBy: (responses, { desc }) => [desc(responses.createdAt)],
  })
  return NextResponse.json({ responses: responsesList })
}

// POST a response (bid) on an order
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getTokenFromHeaders(req.headers) || (() => { const c = req.cookies.get('token'); return c?.value || null })()
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Токен истёк' }, { status: 401 })

  const { id } = await params
  const schema = z.object({
    message: z.string().min(10, 'Минимум 10 символов'),
    proposedBudget: z.number().optional(),
    proposedDeadline: z.string().optional(),
  })

  try {
    const body = schema.parse(await req.json())

    // Check not already responded
    const existing = await db.query.responses.findFirst({
      where: and(eq(responses.orderId, id), eq(responses.executorId, payload.userId)),
    })
    if (existing) return NextResponse.json({ error: 'Вы уже откликнулись на этот заказ' }, { status: 409 })

    const [response] = await db.insert(responses).values({
      id: randomUUID(),
      orderId: id,
      executorId: payload.userId,
      message: body.message,
      proposedBudget: body.proposedBudget || null,
      proposedDeadline: body.proposedDeadline ? new Date(body.proposedDeadline).toISOString() : null,
      createdAt: new Date().toISOString(),
    }).returning()

    // Fetch with executor
    const responseWithExecutor = await db.query.responses.findFirst({
      where: eq(responses.id, response.id),
      with: { executor: { columns: { id: true, name: true, role: true }, with: { profile: true } } },
    })

    return NextResponse.json({ response: responseWithExecutor }, { status: 201 })
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Ошибка отклика' }, { status: 500 })
  }
}

// PATCH — accept or reject a response
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getTokenFromHeaders(req.headers) || (() => { const c = req.cookies.get('token'); return c?.value || null })()
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Токен истёк' }, { status: 401 })

  const { id: orderId } = await params
  const { responseId, status } = await req.json()
  if (!['ACCEPTED', 'REJECTED'].includes(status)) return NextResponse.json({ error: 'Неверный статус' }, { status: 400 })

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  })
  if (!order || order.clientId !== payload.userId) return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

  const [updated] = await db.update(responses)
    .set({ status })
    .where(eq(responses.id, responseId))
    .returning()

  // Fetch with executor for response
  const responseWithExecutor = await db.query.responses.findFirst({
    where: eq(responses.id, updated.id),
    with: { executor: { columns: { id: true, name: true } } },
  })

  if (status === 'ACCEPTED' && responseWithExecutor) {
    await db.update(orders)
      .set({ status: 'IN_PROGRESS', executorId: responseWithExecutor.executorId, updatedAt: new Date().toISOString() })
      .where(eq(orders.id, orderId))
  }

  return NextResponse.json({ response: responseWithExecutor })
}
