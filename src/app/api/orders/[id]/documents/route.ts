import { db } from '@/lib/db'
import { orderDocuments, users } from '@/lib/schema'
import { eq, desc, and } from 'drizzle-orm'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const MAX_FILE_SIZE = 10 * 1024 * 1024

async function ensureTable() {
  try {
    await db.run(`CREATE TABLE IF NOT EXISTS OrderDocument (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      uploadedById TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      size INTEGER NOT NULL,
      dataUrl TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`)
  } catch { /* already exists */ }
}

async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  return `data:${file.type || 'application/octet-stream'};base64,${buffer.toString('base64')}`
}

// GET /api/orders/[id]/documents
// ?download=docId → returns file as binary
// no query → returns document list
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await verifyToken(getTokenFromHeaders(req.headers))
  if (!payload) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

  const { id } = await params
  const url = new URL(req.url)
  const downloadId = url.searchParams.get('download')

  try {
    await ensureTable()

    // Download single file
    if (downloadId) {
      const [doc] = await db
        .select()
        .from(orderDocuments)
        .where(and(eq(orderDocuments.id, downloadId), eq(orderDocuments.orderId, id)))
        .limit(1)

      if (!doc) return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })

      // Convert data URL to buffer
      const base64Data = doc.dataUrl.split(',')[1]
      if (!base64Data) return NextResponse.json({ error: 'Некорректный файл' }, { status: 500 })

      const buffer = Buffer.from(base64Data, 'base64')
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': doc.type,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.name)}"`,
          'Content-Length': String(buffer.length),
        },
      })
    }

    // List documents
    const docs = await db
      .select({
        id: orderDocuments.id,
        name: orderDocuments.name,
        type: orderDocuments.type,
        size: orderDocuments.size,
        createdAt: orderDocuments.createdAt,
        uploadedById: orderDocuments.uploadedById,
        uploaderName: users.name,
      })
      .from(orderDocuments)
      .leftJoin(users, eq(orderDocuments.uploadedById, users.id))
      .where(eq(orderDocuments.orderId, id))
      .orderBy(desc(orderDocuments.createdAt))

    return NextResponse.json({ documents: docs })
  } catch (e) {
    console.error('Get documents error:', e)
    return NextResponse.json({ error: 'Ошибка загрузки документов' }, { status: 500 })
  }
}

// POST /api/orders/[id]/documents
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await verifyToken(getTokenFromHeaders(req.headers))
  if (!payload) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

  const { id } = await params

  try {
    await ensureTable()

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'Файл не найден' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Файл слишком большой (макс. 10 МБ)' }, { status: 400 })

    const dataUrl = await fileToDataUrl(file)
    const docId = randomUUID()

    await db.insert(orderDocuments).values({
      id: docId,
      orderId: id,
      uploadedById: payload.userId,
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      dataUrl,
    })

    return NextResponse.json({
      document: {
        id: docId,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        createdAt: new Date().toISOString(),
        uploadedById: payload.userId,
      },
    })
  } catch (e) {
    console.error('Upload document error:', e)
    return NextResponse.json({ error: 'Ошибка загрузки документа' }, { status: 500 })
  }
}