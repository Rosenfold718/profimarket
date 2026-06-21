import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function trackActivity(userId: string, action: string, details?: Record<string, unknown>, ip?: string) {
  try {
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 32)
    await db.run(sql`
      INSERT OR IGNORE INTO ActivityLog (id, userId, action, details, ip, createdAt)
      VALUES (${id}, ${userId}, ${action}, ${details ? JSON.stringify(details) : null}, ${ip || 'unknown'}, ${new Date().toISOString()})
    `)
  } catch {
    // Table might not exist yet — that's OK, it'll be created on first admin visit
  }
}