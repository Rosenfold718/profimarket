import { db } from '@/lib/db'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/users — search users (executors)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const search = url.searchParams.get('search') || undefined
  const role = url.searchParams.get('role') || undefined
  const specializations = url.searchParams.get('specializations') || undefined
  const region = url.searchParams.get('region') || undefined
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')))

  const where: Record<string, unknown> = {}
  if (role) where.role = role
  if (search) where.OR = [{ name: { contains: search } }]
  if (specializations || region) {
    where.profile = {}
    if (specializations) (where.profile as Record<string, unknown>).specializations = { contains: specializations }
    if (region) (where.profile as Record<string, unknown>).region = region
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: { id: true, name: true, role: true, avatar: true, createdAt: true, profile: true, _count: { select: { responses: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.user.count({ where }),
  ])

  return NextResponse.json({ users, total, page, pages: Math.ceil(total / limit) })
}
