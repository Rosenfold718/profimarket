import { db } from '@/lib/db'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

// GET responses for an order
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const responses = await db.response.findMany({
    where: { orderId: id },
    include: { executor: { select: { id: true, name: true, role: true, profile: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ responses })
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
    const existing = await db.response.findFirst({ where: { orderId: id, executorId: payload.userId } })
    if (existing) return NextResponse.json({ error: 'Вы уже откликнулись на этот заказ' }, { status: 409 })

    const response = await db.response.create({
      data: {
        orderId: id,
        executorId: payload.userId,
        message: body.message,
        proposedBudget: body.proposedBudget,
        proposedDeadline: body.proposedDeadline ? new Date(body.proposedDeadline) : null,
      },
      include: { executor: { select: { id: true, name: true, role: true, profile: true } } },
    })
    return NextResponse.json({ response }, { status: 201 })
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

  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order || order.clientId !== payload.userId) return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

  const response = await db.response.update({
    where: { id: responseId },
    data: { status },
    include: { executor: { select: { id: true, name: true } } },
  })

  if (status === 'ACCEPTED') {
    await db.order.update({
      where: { id: orderId },
      data: { status: 'IN_PROGRESS', executorId: response.executorId },
    })
  }

  return NextResponse.json({ response })
}
