import { db } from '@/lib/db'
import { categories } from '@/lib/schema'
import { asc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function GET() {
  const categoriesList = await db.query.categories.findMany({
    orderBy: (categories, { asc }) => [asc(categories.order)],
  })
  return NextResponse.json({ categories: categoriesList })
}

export async function POST(req: Request) {
  const { name, slug, icon, description, order } = await req.json()
  const [category] = await db.insert(categories).values({
    id: randomUUID(),
    name,
    slug,
    icon: icon || null,
    description: description || null,
    order: order || 0,
  }).returning()
  return NextResponse.json({ category }, { status: 201 })
}
