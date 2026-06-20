import { db } from '@/lib/db'
import { messages, orders } from '@/lib/schema'
import { eq, asc, gt, and } from 'drizzle-orm'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { randomUUID } from 'crypto'

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
  const url = new URL(req.url)
  const since = url.searchParams.get('since')

  const whereConditions = [eq(messages.orderId, id)]
  if (since) {
    whereConditions.push(gt(messages.createdAt, since))
  }

  const messagesList = await db.query.messages.findMany({
    where: and(...whereConditions),
    with: { sender: { columns: { id: true, name: true, role: true, avatar: true } } },
    orderBy: (messages, { asc }) => [asc(messages.createdAt)],
    limit: 200,
  })
  return NextResponse.json({ messages: messagesList })
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

    const [message] = await db.insert(messages).values({
      id: randomUUID(),
      orderId: id,
      senderId: payload.userId,
      content: body.content,
      read: false,
      createdAt: new Date().toISOString(),
    }).returning()

    // Fetch with sender
    const messageWithSender = await db.query.messages.findFirst({
      where: eq(messages.id, message.id),
      with: { sender: { columns: { id: true, name: true, role: true, avatar: true } } },
    })

    return NextResponse.json({ message: messageWithSender }, { status: 201 })
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0].message }, { status: 400 })
    console.error('Order message insert error:', e)
    return NextResponse.json({ error: 'Ошибка отправки' }, { status: 500 })
  }
}
