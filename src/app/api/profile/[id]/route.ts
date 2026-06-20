import { db } from '@/lib/db'
import { users, profiles, orders, responses } from '@/lib/schema'
import { eq, and, count } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params: p }: { params: Promise<{ id: string }> }
) {
  const { id } = await p

  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: {
      id: true, name: true, role: true, phone: true, avatar: true, createdAt: true,
      email: true, passwordHash: false,
    },
    with: { profile: true },
  })

  if (!user) return NextResponse.json({ error: 'Не найден' }, { status: 404 })

  // Get counts
  const [clientOrderCount] = await db
    .select({ count: count() })
    .from(orders)
    .where(eq(orders.clientId, id))

  const [executorOrderCount] = await db
    .select({ count: count() })
    .from(orders)
    .where(eq(orders.executorId, id))

  const [responseCount] = await db
    .select({ count: count() })
    .from(responses)
    .where(eq(responses.executorId, id))

  return NextResponse.json({
    user: {
      ...user,
      _count: {
        clientOrders: clientOrderCount.count,
        executorOrders: executorOrderCount.count,
        responses: responseCount.count,
      },
    },
  })
}
