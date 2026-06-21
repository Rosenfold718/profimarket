import { db } from '@/lib/db'
import { messages, users } from '@/lib/schema'
import { eq, asc, gt, and, ne } from 'drizzle-orm'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { trackActivity } from '@/lib/track'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { randomUUID } from 'crypto'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  return `data:${file.type || 'application/octet-stream'};base64,${base64}`
}

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

  const messagesList = await db.select({
    id: messages.id,
    content: messages.content,
    senderId: messages.senderId,
    read: messages.read,
    createdAt: messages.createdAt,
    attachmentUrl: messages.attachmentUrl,
    attachmentName: messages.attachmentName,
    attachmentType: messages.attachmentType,
    attachmentSize: messages.attachmentSize,
    sender: { id: users.id, name: users.name, role: users.role, avatar: users.avatar },
  })
  .from(messages)
  .leftJoin(users, eq(messages.senderId, users.id))
  .where(and(...whereConditions))
  .orderBy(asc(messages.createdAt))
  .limit(200)

  return NextResponse.json({ messages: messagesList })
}

// POST a message (supports file attachment via multipart/form-data)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getTokenFromHeaders(req.headers) || (() => { const c = req.cookies.get('token'); return c?.value || null })()
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Токен истёк' }, { status: 401 })

  const { id } = await params

  try {
    const contentType = req.headers.get('content-type') || ''

    let content = ''
    let attachmentUrl: string | null = null
    let attachmentName: string | null = null
    let attachmentType: string | null = null
    let attachmentSize: number | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const rawContent = formData.get('content')
      if (typeof rawContent === 'string') content = rawContent.trim()

      const file = formData.get('file') as File | null
      if (file && file.size > 0) {
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({ error: 'Файл слишком большой (макс. 10 МБ)' }, { status: 400 })
        }
        const dataUrl = await fileToDataUrl(file)
        attachmentUrl = dataUrl
        attachmentName = file.name
        attachmentType = file.type || 'application/octet-stream'
        attachmentSize = file.size
      }

      if (!content && !attachmentUrl) {
        return NextResponse.json({ error: 'Введите сообщение или прикрепите файл' }, { status: 400 })
      }
    } else {
      // Handle JSON body (backward compatible)
      const schema = z.object({ content: z.string().min(1).max(5000) })
      const body = schema.parse(await req.json())
      content = body.content
    }

    // Get sender info for the response
    const [sender] = await db.select({ id: users.id, name: users.name, role: users.role, avatar: users.avatar })
      .from(users).where(eq(users.id, payload.userId)).limit(1)

    const [message] = await db.insert(messages).values({
      id: randomUUID(),
      orderId: id,
      senderId: payload.userId,
      content: content || '(файл)',
      read: false,
      attachmentUrl,
      attachmentName,
      attachmentType,
      attachmentSize,
      createdAt: new Date().toISOString(),
    }).returning()

    const messageWithSender = { ...message, sender: sender || { id: payload.userId, name: 'Вы', role: 'USER', avatar: null } }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    trackActivity(payload.userId, 'send_message', { orderId: id, messageId: message.id }, ip)

    return NextResponse.json({ message: messageWithSender }, { status: 201 })
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0].message }, { status: 400 })
    console.error('Order message insert error:', e)
    return NextResponse.json({ error: 'Ошибка отправки' }, { status: 500 })
  }
}

// PATCH /api/orders/[id]/messages — mark messages as read
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getTokenFromHeaders(req.headers) || (() => { const c = req.cookies.get('token'); return c?.value || null })()
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Токен истёк' }, { status: 401 })

  const { id } = await params

  await db.update(messages)
    .set({ read: true })
    .where(and(eq(messages.orderId, id), ne(messages.senderId, payload.userId), eq(messages.read, false)))

  return NextResponse.json({ ok: true })
}