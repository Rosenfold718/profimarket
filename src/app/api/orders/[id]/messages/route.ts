import { db } from '@/lib/db'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

// GET messages for an order
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getTokenFromHeaders(req.headers) || (() => { const c = req.cookies.get('token'); return c?.value || null })()
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Токен истёк' }, { status: 401 })

  const { id } = await params
  const messages = await db.message.findMany({
    where: { orderId: id },
    include: { sender: { select: { id: true, name: true, role: true, avatar: true } } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  })
  return NextResponse.json({ messages })
}

// POST a message (also saved via REST for fallback)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getTokenFromHeaders(req.headers) || (() => { const c = req.cookies.get('token'); return c?.value || null })()
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Токен истёк' }, { status: 401 })

  const { id } = await params
  const schema = z.object({ content: z.string().min(1).max(5000) })

  try {
    const body = schema.parse(await req.json())
    const message = await db.message.create({
      data: { orderId: id, senderId: payload.userId, content: body.content },
      include: { sender: { select: { id: true, name: true, role: true, avatar: true } } },
    })
    return NextResponse.json({ message }, { status: 201 })
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Ошибка отправки' }, { status: 500 })
  }
}
