import { db } from '@/lib/db'
import { orders } from '@/lib/schema'
import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

// GET /api/orders/regions — distinct regions from open orders
export async function GET() {
  const result = await db
    .selectDistinct({ region: orders.region })
    .from(orders)
    .where(sql`${orders.region} IS NOT NULL AND ${orders.region} != ''`)
    .orderBy(orders.region)

  const regions = result
    .map(r => r.region)
    .filter((r): r is string => typeof r === 'string' && r.length > 0)

  return NextResponse.json({ regions })
}