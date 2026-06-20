import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getTokenFromHeaders, verifyToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/auth/heartbeat — update user's lastSeenAt
export async function POST(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date().toISOString()
  await db.update(users).set({ lastSeenAt: now }).where(eq(users.id, payload.userId))

  return NextResponse.json({ ok: true, lastSeenAt: now })
}