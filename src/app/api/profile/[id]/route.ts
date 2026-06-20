import { db } from '@/lib/db'
import { users, profiles, orders, responses, categories } from '@/lib/schema'
import { eq, desc, count } from 'drizzle-orm'
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

  // Get client orders with category info
  const clientOrders = await db
    .select({
      id: orders.id,
      title: orders.title,
      status: orders.status,
      budgetFrom: orders.budgetFrom,
      budgetTo: orders.budgetTo,
      city: orders.city,
      region: orders.region,
      createdAt: orders.createdAt,
      categoryName: categories.name,
    })
    .from(orders)
    .leftJoin(categories, eq(orders.categoryId, categories.id))
    .where(eq(orders.clientId, id))
    .orderBy(desc(orders.createdAt))
    .limit(50)

  return NextResponse.json({
    user: {
      ...user,
      _count: {
        clientOrders: clientOrderCount.count,
        executorOrders: executorOrderCount.count,
        responses: responseCount.count,
      },
      clientOrders,
    },
  })
}
