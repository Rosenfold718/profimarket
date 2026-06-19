import { db } from '@/lib/db'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'

// GET /api/orders — list orders with filters
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const status = url.searchParams.get('status') || undefined
  const category = url.searchParams.get('category') || undefined
  const region = url.searchParams.get('region') || undefined
  const search = url.searchParams.get('search') || undefined
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')))

  const where: Record<string, unknown> = {}
  if (status) {
    const statuses = status.split(',').map(s => s.trim())
    if (statuses.length === 1) {
      where.status = statuses[0]
    } else {
      where.status = { in: statuses }
    }
  } else {
    where.status = 'OPEN'
  }
  if (category) where.category = { slug: category }
  if (region) where.region = region
  if (search) where.OR = [
    { title: { contains: search } },
    { description: { contains: search } },
  ]

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      include: { client: { select: { id: true, name: true, role: true } }, category: true, _count: { select: { responses: true, messages: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.order.count({ where }),
  ])

  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) })
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
    const order = await db.order.create({
      data: {
        ...data,
        deadline: data.deadline ? new Date(data.deadline) : null,
        clientId: payload.userId,
      },
      include: { client: { select: { id: true, name: true, role: true } }, category: true },
    })
    return NextResponse.json({ order }, { status: 201 })
  } catch (e: unknown) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Ошибка создания заказа' }, { status: 500 })
  }
}
