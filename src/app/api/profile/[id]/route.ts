import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params: p }: { params: Promise<{ id: string }> }
) {
  const { id } = await p
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, role: true, phone: true, avatar: true, createdAt: true,
      profile: true,
      _count: { select: { clientOrders: true, executorOrders: true, responses: true } },
    },
  })
  if (!user) return NextResponse.json({ error: 'Не найден' }, { status: 404 })
  return NextResponse.json({ user })
}
