import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const MAX_FILE_SIZE = 10 * 1024 * 1024

async function ensureTables() {
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS UploadSession (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      uploadedById TEXT NOT NULL,
      fileName TEXT NOT NULL,
      fileType TEXT NOT NULL,
      fileSize INTEGER NOT NULL,
      totalChunks INTEGER NOT NULL,
      receivedChunks INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`)
  } catch { /* exists */ }
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS OrderDocument (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      uploadedById TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      size INTEGER NOT NULL,
      dataUrl TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )`)
  } catch { /* exists */ }
}

// POST /api/upload-chunk
export async function POST(req: NextRequest) {
  const payload = await verifyToken(getTokenFromHeaders(req.headers))
  if (!payload) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

  try {
    await ensureTables()

    const body = await req.json()
    const { sessionId, orderId, fileName, fileType, fileSize, totalChunks, chunkIndex, chunkData } = body

    if (sessionId === undefined || chunkIndex === undefined || !chunkData || !orderId) {
      return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })
    }

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Файл слишком большой (макс. 10 МБ)' }, { status: 400 })
    }

    const sid = String(sessionId)
    const ci = Number(chunkIndex)
    const tc = Number(totalChunks)

    if (ci === 0) {
      await db.execute(sql`INSERT INTO UploadSession (id, orderId, uploadedById, fileName, fileType, fileSize, totalChunks, receivedChunks, data)
        VALUES (${sid}, ${orderId}, ${payload.userId}, ${fileName || 'file'}, ${fileType || 'application/octet-stream'}, ${fileSize}, ${tc}, 1, ${chunkData})`)
    } else {
      const result = await db.execute(sql`SELECT receivedChunks FROM UploadSession WHERE id = ${sid}`)
      const current = (result.rows as any[])?.[0]?.receivedChunks
      if (Number(current) !== ci) {
        return NextResponse.json({ error: 'Нарушен порядок чанков' }, { status: 400 })
      }
      await db.execute(sql`UPDATE UploadSession SET receivedChunks = receivedChunks + 1, data = data || ${chunkData} WHERE id = ${sid}`)
    }

    const rows = await db.execute(sql`SELECT receivedChunks, totalChunks, data, fileName, fileType, fileSize FROM UploadSession WHERE id = ${sid}`)
    const session = (rows.rows as any[])?.[0]

    if (!session) {
      return NextResponse.json({ error: 'Сессия не найдена' }, { status: 404 })
    }

    if (Number(session.receivedChunks) >= Number(session.totalChunks)) {
      const dataUrl = `data:${session.fileType};base64,${session.data}`
      const docId = randomUUID()

      await db.execute(sql`INSERT INTO OrderDocument (id, orderId, uploadedById, name, type, size, dataUrl, createdAt)
        VALUES (${docId}, ${orderId}, ${payload.userId}, ${session.fileName}, ${session.fileType}, ${session.fileSize}, ${dataUrl}, CURRENT_TIMESTAMP)`)
      await db.execute(sql`DELETE FROM UploadSession WHERE id = ${sid}`)

      return NextResponse.json({
        done: true,
        document: {
          id: docId,
          name: session.fileName,
          type: session.fileType,
          size: Number(session.fileSize),
          createdAt: new Date().toISOString(),
          uploadedById: payload.userId,
        },
      })
    }

    return NextResponse.json({ done: false, chunk: ci + 1, total: tc })
  } catch (e) {
    console.error('Upload chunk error:', e)
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 })
  }
}