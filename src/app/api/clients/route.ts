import { db } from '@/lib/db'
import { users, profiles, orders } from '@/lib/schema'
import { eq, and, desc, count, like } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/clients — search clients (users with role='CLIENT')
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const search = url.searchParams.get('search') || undefined
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')))

  const conditions: any[] = [eq(users.role, 'CLIENT')]
  if (search) conditions.push(like(users.name, `%${search}%`))

  const skip = (page - 1) * limit

  // Query clients — left join profiles (clients may not have profiles)
  const clientsList = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      avatar: users.avatar,
      createdAt: users.createdAt,
      profileId: profiles.id,
      profileCompany: profiles.company,
      profilePosition: profiles.position,
      profileCity: profiles.city,
      profileRegion: profiles.region,
      profileDescription: profiles.description,
    })
    .from(users)
    .leftJoin(profiles, eq(users.id, profiles.userId))
    .where(and(...conditions))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(skip)

  // Get order counts per client
  const clientIds = clientsList.map(u => u.id)
  const orderCounts: Record<string, number> = {}

  if (clientIds.length > 0) {
    const countResults = await db
      .select({ clientId: orders.clientId, cnt: count() })
      .from(orders)
      .groupBy(orders.clientId)

    for (const r of countResults) {
      if (clientIds.includes(r.clientId)) {
        orderCounts[r.clientId] = r.cnt
      }
    }
  }

  const clientsWithProfile = clientsList.map(u => ({
    id: u.id,
    name: u.name,
    role: u.role,
    avatar: u.avatar,
    createdAt: u.createdAt,
    profile: u.profileId ? {
      id: u.profileId,
      company: u.profileCompany,
      position: u.profilePosition,
      city: u.profileCity,
      region: u.profileRegion,
      description: u.profileDescription,
    } : null,
    _count: { orders: orderCounts[u.id] || 0 },
  }))

  // Get total count
  const totalResult = await db
    .select({ total: count() })
    .from(users)
    .where(and(...conditions))

  const total = totalResult[0]?.total || 0

  return NextResponse.json({ clients: clientsWithProfile, total, page, pages: Math.ceil(total / limit) })
}