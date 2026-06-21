import { db } from '@/lib/db'
import { orders, users, categories, responses, messages } from '@/lib/schema'
import { eq, and, or, desc, sql, count, like, inArray } from 'drizzle-orm'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { trackActivity } from '@/lib/track'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { randomUUID } from 'crypto'

// GET /api/orders — list orders with filters
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const status = url.searchParams.get('status') || undefined
  const category = url.searchParams.get('category') || undefined
  const region = url.searchParams.get('region') || undefined
  const search = url.searchParams.get('search') || undefined
  const includeResponses = url.searchParams.get('includeResponses') === 'true'
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')))

  // Build where conditions
  const conditions: any[] = []

  // Status filter
  if (status) {
    const statuses = status.split(',').map(s => s.trim())
    if (statuses.length === 1) {
      conditions.push(eq(orders.status, statuses[0]))
    } else {
      conditions.push(inArray(orders.status, statuses))
    }
  } else {
    conditions.push(eq(orders.status, 'OPEN'))
  }

  if (region) conditions.push(eq(orders.region, region))

  if (category) {
    conditions.push(eq(categories.slug, category))
  }

  if (search) {
    conditions.push(or(
      like(orders.title, `%${search}%`),
      like(orders.description, `%${search}%`),
    ))
  }

  const whereClause = category
    ? and(...conditions)
    : and(...conditions)

  const skip = (page - 1) * limit

  // Fetch orders with client, category, and counts
  const ordersResult = await db
    .select({
      id: orders.id,
      title: orders.title,
      description: orders.description,
      categoryId: orders.categoryId,
      region: orders.region,
      city: orders.city,
      budgetFrom: orders.budgetFrom,
      budgetTo: orders.budgetTo,
      deadline: orders.deadline,
      status: orders.status,
      clientId: orders.clientId,
      executorId: orders.executorId,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      client: { id: users.id, name: users.name, role: users.role },
      category: { id: categories.id, name: categories.name, slug: categories.slug, icon: categories.icon, description: categories.description, order: categories.order },
    })
    .from(orders)
    .leftJoin(users, eq(orders.clientId, users.id))
    .leftJoin(categories, eq(orders.categoryId, categories.id))
    .where(whereClause)
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(skip)

  // Get counts for each order
  const orderIds = ordersResult.map(o => o.id)

  let responseCounts: Record<string, number> = {}
  let messageCounts: Record<string, number> = {}

  if (orderIds.length > 0) {
    const responseCountResults = await db
      .select({ orderId: responses.orderId, count: count() })
      .from(responses)
      .where(inArray(responses.orderId, orderIds))
      .groupBy(responses.orderId)

    const messageCountResults = await db
      .select({ orderId: messages.orderId, count: count() })
      .from(messages)
      .where(inArray(messages.orderId, orderIds))
      .groupBy(messages.orderId)

    responseCounts = Object.fromEntries(responseCountResults.map(r => [r.orderId, r.count]))
    messageCounts = Object.fromEntries(messageCountResults.map(r => [r.orderId, r.count]))
  }

  const ordersWithCounts = ordersResult.map(o => ({
    ...o,
    _count: {
      responses: responseCounts[o.id] || 0,
      messages: messageCounts[o.id] || 0,
    },
  }))

  // Optionally include full response data with executor info
  if (includeResponses && orderIds.length > 0) {
    const responsesData = await db
      .select({
        id: responses.id,
        orderId: responses.orderId,
        executorId: responses.executorId,
        message: responses.message,
        proposedBudget: responses.proposedBudget,
        proposedDeadline: responses.proposedDeadline,
        status: responses.status,
        createdAt: responses.createdAt,
        executorId2: users.id,
        executorName: users.name,
        executorRole: users.role,
      })
      .from(responses)
      .leftJoin(users, eq(responses.executorId, users.id))
      .where(inArray(responses.orderId, orderIds))

    const responsesByOrder: Record<string, Array<Record<string, unknown>>> = {}
    for (const r of responsesData) {
      if (!responsesByOrder[r.orderId]) responsesByOrder[r.orderId] = []
      responsesByOrder[r.orderId].push({
        id: r.id,
        orderId: r.orderId,
        executorId: r.executorId,
        message: r.message,
        proposedBudget: r.proposedBudget,
        proposedDeadline: r.proposedDeadline,
        status: r.status,
        createdAt: r.createdAt,
        executor: {
          id: r.executorId2 || r.executorId,
          name: r.executorName,
          role: r.executorRole,
        },
      })
    }

    for (const o of ordersWithCounts) {
      (o as Record<string, unknown>).responses = responsesByOrder[o.id] || []
    }
  }

  // Get total count
  const totalResult = category
    ? await db
        .select({ total: count() })
        .from(orders)
        .innerJoin(categories, eq(orders.categoryId, categories.id))
        .where(whereClause)
    : await db
        .select({ total: count() })
        .from(orders)
        .where(whereClause)

  const total = totalResult[0]?.total || 0

  return NextResponse.json({ orders: ordersWithCounts, total, page, pages: Math.ceil(total / limit) })
}

// POST /api/orders — create order
export async function POST(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers) || (() => { const c = req.cookies.get('token'); return c?.value || null })()
  if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'CLIENT') return NextResponse.json({ error: 'Только клиенты могут создавать заказы' }, { status: 403 })

  const schema = z.object({
    title: z.string().min(5, 'Минимум 5 символов'),
    description: z.string().min(20, 'Минимум 20 символов'),
    categoryId: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
    budgetFrom: z.number().optional(),
    budgetTo: z.number().optional(),
    deadline: z.string().optional(),
  })

  try {
    const body = await req.json()
    const data = schema.parse(body)
    const now = new Date().toISOString()

    const [order] = await db.insert(orders).values({
      id: randomUUID(),
      title: data.title,
      description: data.description,
      categoryId: data.categoryId || null,
      region: data.region || null,
      city: data.city || null,
      budgetFrom: data.budgetFrom || null,
      budgetTo: data.budgetTo || null,
      deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      status: 'OPEN',
      clientId: payload.userId,
      createdAt: now,
      updatedAt: now,
    }).returning()

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    trackActivity(payload.userId, 'create_order', { orderId: order.id, title: data.title }, ip)

    return NextResponse.json({ order }, { status: 201 })
  } catch (e: unknown) {
    console.error('Order creation error:', e)
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Ошибка создания заказа' }, { status: 500 })
  }
}
