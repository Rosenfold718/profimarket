import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from '@/lib/schema'

// Turso cloud database — used when TURSO_URL is set (Vercel production)
// or when USE_TURSO=true is explicitly set (local dev override)
const useTurso = !!process.env.TURSO_URL && process.env.TURSO_URL.startsWith('libsql://')

const dbUrl = useTurso
  ? process.env.TURSO_URL
  : (process.env.DATABASE_URL || 'file:./db/custom.db')

const authToken = useTurso ? process.env.TURSO_AUTH_TOKEN : undefined

const client = createClient({ url: dbUrl, authToken })

export const db = drizzle(client, { schema })