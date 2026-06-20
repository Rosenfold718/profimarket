import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from '@/lib/schema'

// Use local SQLite for development, Turso for production (Vercel)
// Set USE_TURSO=true to force Turso in development
const useTurso = process.env.USE_TURSO === 'true' || (!process.env.DATABASE_URL && !!process.env.TURSO_URL)
const dbUrl = useTurso
  ? (process.env.TURSO_URL || 'file:./db/custom.db')
  : (process.env.DATABASE_URL || 'file:./db/custom.db')
const authToken = useTurso ? process.env.TURSO_AUTH_TOKEN : undefined

const client = createClient({ url: dbUrl, authToken })

export const db = drizzle(client, { schema })
