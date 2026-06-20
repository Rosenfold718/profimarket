import { db } from '@/lib/db'
import { messages, orders } from '@/lib/schema'
import { eq, asc, gt, and } from 'drizzle-orm'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { randomUUID } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'chat-attachments')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true })
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

  const messagesList = await db.query.messages.findMany({
    where: and(...whereConditions),
    with: { sender: { columns: { id: true, name: true, role: true, avatar: true } } },
    orderBy: (messages, { asc }) => [asc(messages.createdAt)],
    limit: 200,
  })
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
      const schema = z.object({ content: z.string().min(1).max(5000) })
      const body = schema.parse(await req.json())
      content = body.content
    }

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