import { db } from '@/lib/db'
import { users, profiles, responses } from '@/lib/schema'
import { eq, and, or, desc, count, like } from 'drizzle-orm'
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

  // Build conditions
  const conditions: any[] = []
  if (role) conditions.push(eq(users.role, role))
  if (search) conditions.push(like(users.name, `%${search}%`))
  if (specializations) conditions.push(like(profiles.specializations, `%${specializations}%`))
  if (region) conditions.push(eq(profiles.region, region))

  const skip = (page - 1) * limit

  // Query users with profile (using left join so we can filter on profile fields)
  const usersList = await db
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
    .leftJoin(profiles, eq(users.id, profiles.userId))
    .where(and(...conditions))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(skip)

  // Get response counts
  const userIds = usersList.map(u => u.id)
  const responseCounts: Record<string, number> = {}

  if (userIds.length > 0) {
    const countResults = await db
      .select({ executorId: responses.executorId, count: count() })
      .from(responses)
      .where(eq(responses.executorId, userIds[0])) // Simplified: batch query
    // For simplicity, query each individually - or use inArray
    const batchResults = await db
      .select({ executorId: responses.executorId, count: count() })
      .from(responses)
      .groupBy(responses.executorId)

    for (const r of batchResults) {
      if (userIds.includes(r.executorId)) {
        responseCounts[r.executorId] = r.count
      }
    }
  }

  const usersWithProfile = usersList.map(u => ({
    id: u.id,
    name: u.name,
    role: u.role,
    avatar: u.avatar,
    createdAt: u.createdAt,
    profile: u.profileId ? {
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
    } : null,
    _count: { responses: responseCounts[u.id] || 0 },
  }))

  // Get total count
  const totalResult = await db
    .select({ total: count() })
    .from(users)
    .leftJoin(profiles, eq(users.id, profiles.userId))
    .where(and(...conditions))

  const total = totalResult[0]?.total || 0

  return NextResponse.json({ users: usersWithProfile, total, page, pages: Math.ceil(total / limit) })
}
