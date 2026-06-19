import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const categories = await db.category.findMany({ orderBy: { order: 'asc' } })
  return NextResponse.json({ categories })
}

export async function POST(req: Request) {
  const { name, slug, icon, description, order } = await req.json()
  const category = await db.category.create({ data: { name, slug, icon: icon || null, description: description || null, order: order || 0 } })
  return NextResponse.json({ category }, { status: 201 })
}
