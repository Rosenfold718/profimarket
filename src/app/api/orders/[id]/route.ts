import { db } from '@/lib/db'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const order = await db.order.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, role: true, phone: true, avatar: true, profile: true } },
      executor: { select: { id: true, name: true, role: true, phone: true, avatar: true, profile: true } },
      category: true,
      responses: { include: { executor: { select: { id: true, name: true, role: true, avatar: true, profile: true } } }, orderBy: { createdAt: 'desc' } },
      _count: { select: { messages: true } },
    },
  })
  if (!order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
  return NextResponse.json({ order })
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
  const order = await db.order.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 })
  if (order.clientId !== payload.userId) return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })

  try {
    const body = await req.json()
    const updated = await db.order.update({
      where: { id },
      data: body, // status, executorId, etc
      include: { client: { select: { id: true, name: true, avatar: true } }, category: true, executor: { select: { id: true, name: true, avatar: true } } },
    })
    return NextResponse.json({ order: updated })
  } catch {
    return NextResponse.json({ error: 'Ошибка обновления' }, { status: 500 })
  }
}
