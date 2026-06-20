import { db } from '@/lib/db'
import { messages, conversations, users } from '@/lib/schema'
import { eq, and, ne, asc, sql } from 'drizzle-orm'
import { getTokenFromHeaders, verifyToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'chat-attachments')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true })
}

// GET /api/conversations/[id]/messages
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params

  // Verify user is part of this conversation
  const conv = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
  if (!conv.length || (conv[0].user1Id !== payload.userId && conv[0].user2Id !== payload.userId)) {
    return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  }

  const url = new URL(req.url)
  const since = url.searchParams.get('since')

  // Build where conditions
  const conditions = [eq(messages.conversationId, id)]
  if (since) {
    conditions.push(sql`${messages.createdAt} > ${since}`)
  }

  const msgs = await db.select({
    id: messages.id,
    content: messages.content,
    senderId: messages.senderId,
    read: messages.read,
    createdAt: messages.createdAt,
    attachmentUrl: messages.attachmentUrl,
    attachmentName: messages.attachmentName,
    attachmentType: messages.attachmentType,
    attachmentSize: messages.attachmentSize,
    sender: { id: users.id, name: users.name, avatar: users.avatar },
  })
  .from(messages)
  .leftJoin(users, eq(messages.senderId, users.id))
  .where(and(...conditions))
  .orderBy(asc(messages.createdAt))

  return NextResponse.json({ messages: msgs })
}

// POST /api/conversations/[id]/messages — send message (supports file attachment via multipart/form-data)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params

  // Verify user is part of this conversation
  const conv = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
  if (!conv.length || (conv[0].user1Id !== payload.userId && conv[0].user2Id !== payload.userId)) {
    return NextResponse.json({ error: 'Не найдено' }, { status: 404 })
  }

  try {
    const contentType = req.headers.get('content-type') || ''

    let content = ''
    let attachmentUrl: string | null = null
    let attachmentName: string | null = null
    let attachmentType: string | null = null
    let attachmentSize: number | null = null

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart/form-data with optional file
      const formData = await req.formData()
      const rawContent = formData.get('content')
      if (typeof rawContent === 'string') content = rawContent.trim()

      const file = formData.get('file') as File | null
      if (file && file.size > 0) {
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json({ error: 'Файл слишком большой (макс. 10 МБ)' }, { status: 400 })
        }
        await ensureUploadDir()
        const uuid = randomUUID()
        const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
        const savedName = `${uuid}${ext}`
        const filePath = join(UPLOAD_DIR, savedName)

        const bytes = await file.arrayBuffer()
        await writeFile(filePath, new Uint8Array(bytes))

        attachmentUrl = `/uploads/chat-attachments/${savedName}`
        attachmentName = file.name
        attachmentType = file.type || 'application/octet-stream'
        attachmentSize = file.size
      }

      if (!content && !attachmentUrl) {
        return NextResponse.json({ error: 'Введите сообщение или прикрепите файл' }, { status: 400 })
      }
    } else {
      // Handle JSON body (backward compatible)
      const schema = z.object({ content: z.string().min(1, 'Введите сообщение').max(5000) })
      const body = schema.parse(await req.json())
      content = body.content.trim()
    }

    // Get sender info for the response
    const [sender] = await db.select({ id: users.id, name: users.name, avatar: users.avatar })
      .from(users).where(eq(users.id, payload.userId)).limit(1)

    const now = new Date().toISOString()
    const [msg] = await db.insert(messages).values({
      id: randomUUID(),
      conversationId: id,
      senderId: payload.userId,
      content: content || '(файл)',
      read: false,
      attachmentUrl,
      attachmentName,
      attachmentType,
      attachmentSize,
      createdAt: now,
    }).returning()

    // Update conversation timestamp
    await db.update(conversations).set({ updatedAt: now }).where(eq(conversations.id, id))

    const msgWithSender = { ...msg, sender: sender || { id: payload.userId, name: 'Вы', avatar: null } }

    return NextResponse.json({ message: msgWithSender }, { status: 201 })
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0].message }, { status: 400 })
    console.error('Conversation message insert error:', e)
    return NextResponse.json({ error: 'Ошибка отправки сообщения' }, { status: 500 })
  }
}

// PATCH /api/conversations/[id]/messages — mark messages as read
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params
  await db.update(messages)
    .set({ read: true })
    .where(and(eq(messages.conversationId, id), ne(messages.senderId, payload.userId)))

  return NextResponse.json({ ok: true })
}