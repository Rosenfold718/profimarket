import { db } from '@/lib/db'
import { orderDocuments } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/orders/[id]/documents/[docId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const payload = await verifyToken(getTokenFromHeaders(req.headers))
  if (!payload) return NextResponse.json({ error: 'Неверный токен' }, { status: 401 })

  const { id, docId } = await params

  try {
    const [doc] = await db
      .select()
      .from(orderDocuments)
      .where(and(eq(orderDocuments.id, docId), eq(orderDocuments.orderId, id)))
      .limit(1)

    if (!doc) return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })

    // Allow client, executor, or admin to delete
    const isOwner = doc.uploadedById === payload.userId
    const isAdmin = payload.role === 'ADMIN'
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
    }

    await db.delete(orderDocuments).where(eq(orderDocuments.id, docId))

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Delete document error:', e)
    return NextResponse.json({ error: 'Ошибка удаления' }, { status: 500 })
  }
}