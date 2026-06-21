import { db } from '@/lib/db'
import { getTokenFromHeaders, verifyToken } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'

// Ensure the ActivityLog table exists
async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ActivityLog (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      ip TEXT,
      createdAt TEXT NOT NULL
    )
  `)
}

async function requireAdmin(req: NextRequest) {
  const token = getTokenFromHeaders(req.headers)
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') return null
  return payload
}

// GET /api/admin/activity — paginated activity log (admin only)
export async function GET(req: NextRequest) {
  try {
    await ensureTable()
    const admin = await requireAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 })

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')))
    const userId = url.searchParams.get('userId') || undefined
    const action = url.searchParams.get('action') || undefined
    const offset = (page - 1) * limit

    // Build WHERE clause with proper parameterization
    let whereSql = sql`1=1`
    if (userId) whereSql = sql`${whereSql} AND al.userId = ${userId}`
    if (action) whereSql = sql`${whereSql} AND al.action = ${action}`

    // Total count
    const countResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM ActivityLog al WHERE ${whereSql}`)
    const total = (countResult.rows[0] as { cnt: number } | undefined)?.cnt || 0

    // Fetch activity entries with user names
    const result = await db.execute(sql`
      SELECT al.*, u.name as userName, u.email as userEmail
      FROM ActivityLog al
      LEFT JOIN User u ON al.userId = u.id
      WHERE ${whereSql}
      ORDER BY al.createdAt DESC
      LIMIT ${limit} OFFSET ${offset}
    `)

    const rows = result.rows as Array<{
      id: string
      userId: string
      action: string
      details: string | null
      ip: string | null
      createdAt: string
      userName: string | null
      userEmail: string | null
    }>

    const activities = rows.map(r => ({
      id: r.id,
      userId: r.userId,
      action: r.action,
      details: r.details ? JSON.parse(r.details) : null,
      ip: r.ip,
      createdAt: r.createdAt,
      user: {
        name: r.userName,
        email: r.userEmail,
      },
    }))

    return NextResponse.json({
      activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (e) {
    console.error('Admin activity log error:', e)
    return NextResponse.json({ error: 'Ошибка загрузки активности' }, { status: 500 })
  }
}

// POST /api/admin/activity — log a new activity entry (authenticated)
export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const token = getTokenFromHeaders(req.headers)
    if (!token) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

    const payload = await verifyToken(token)
    if (!payload) return NextResponse.json({ error: 'Токен истёк' }, { status: 401 })

    const body = await req.json()
    const { userId, action, details, ip } = body as {
      userId: string
      action: string
      details?: Record<string, unknown>
      ip?: string
    }

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId и action обязательны' }, { status: 400 })
    }

    const validActions = [
      'register', 'login', 'create_order', 'send_response',
      'accept_response', 'reject_response', 'send_message',
      'update_profile', 'view_order', 'view_chats', 'view_profile',
    ]
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'Неверное действие' }, { status: 400 })
    }

    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 32)

    await db.execute(sql`
      INSERT OR IGNORE INTO ActivityLog (id, userId, action, details, ip, createdAt)
      VALUES (${id}, ${userId}, ${action}, ${details ? JSON.stringify(details) : null}, ${ip || 'unknown'}, ${new Date().toISOString()})
    `)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Activity log error:', e)
    return NextResponse.json({ error: 'Ошибка записи активности' }, { status: 500 })
  }
}