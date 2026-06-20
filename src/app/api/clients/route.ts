import { db } from '@/lib/db'
import { users, profiles, orders } from '@/lib/schema'
import { eq, and, desc, count, like, isNotNull } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/clients — search clients (users with role='CLIENT' and profiles)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const search = url.searchParams.get('search') || undefined
  const region = url.searchParams.get('region') || undefined
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')))

  // Build conditions — always filter by CLIENT role and ensure profile exists
  const conditions: any[] = [
    eq(users.role, 'CLIENT'),
    isNotNull(profiles.id),
  ]
  if (search) conditions.push(like(users.name, `%${search}%`))
  if (region) conditions.push(eq(profiles.region, region))

  const skip = (page - 1) * limit

  // Query clients with profiles
  const clientsList = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      avatar: users.avatar,
      createdAt: users.createdAt,
      profileId: profiles.id,
      profileUserId: profiles.userId,
      profileCompany: profiles.company,
      profilePosition: profiles.position,
      profileExperienceYears: profiles.experienceYears,
      profileSpecializations: profiles.specializations,
      profileDescription: profiles.description,
      profileRegion: profiles.region,
      profileCity: profiles.city,
      profileEducation: profiles.education,
      profileCertificates: profiles.certificates,
      profileRating: profiles.rating,
      profileCompletedOrders: profiles.completedOrders,
      profileWebsite: profiles.website,
      profileSocialLinks: profiles.socialLinks,
    })
    .from(users)
    .innerJoin(profiles, eq(users.id, profiles.userId))
    .where(and(...conditions))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(skip)

  // Get order counts per client
  const clientIds = clientsList.map(u => u.id)
  const orderCounts: Record<string, number> = {}

  if (clientIds.length > 0) {
    const countResults = await db
      .select({ clientId: orders.clientId, count: count() })
      .from(orders)
      .groupBy(orders.clientId)

    for (const r of countResults) {
      if (clientIds.includes(r.clientId)) {
        orderCounts[r.clientId] = r.count
      }
    }
  }

  const clientsWithProfile = clientsList.map(u => ({
    id: u.id,
    name: u.name,
    role: u.role,
    avatar: u.avatar,
    createdAt: u.createdAt,
    profile: {
      id: u.profileId,
      userId: u.profileUserId,
      company: u.profileCompany,
      position: u.profilePosition,
      experienceYears: u.profileExperienceYears,
      specializations: u.profileSpecializations,
      description: u.profileDescription,
      region: u.profileRegion,
      city: u.profileCity,
      education: u.profileEducation,
      certificates: u.profileCertificates,
      rating: u.profileRating,
      completedOrders: u.profileCompletedOrders,
      website: u.profileWebsite,
      socialLinks: u.profileSocialLinks,
    },
    _count: { orders: orderCounts[u.id] || 0 },
  }))

  // Get total count
  const totalResult = await db
    .select({ total: count() })
    .from(users)
    .innerJoin(profiles, eq(users.id, profiles.userId))
    .where(and(...conditions))

  const total = totalResult[0]?.total || 0

  return NextResponse.json({ clients: clientsWithProfile, total, page, pages: Math.ceil(total / limit) })
}