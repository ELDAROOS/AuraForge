import { NextRequest, NextResponse } from 'next/server'
import { searchFood, getProductByBarcode } from '@/lib/nutrition/openFoodFacts'

/**
 * GET /api/food?q=apple&page=1
 * GET /api/food?barcode=0737628064502
 *
 * Server-side proxy — keeps the User-Agent header controlled,
 * enables Next.js fetch cache, and avoids any CORS issues on mobile.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const barcode = searchParams.get('barcode')
  const query   = searchParams.get('q')
  const page    = Number(searchParams.get('page') ?? '1')

  try {
    if (barcode) {
      const item = await getProductByBarcode(barcode)
      if (!item) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      return NextResponse.json({ item })
    }

    if (!query?.trim()) {
      return NextResponse.json({ error: 'q or barcode param is required' }, { status: 400 })
    }

    const result = await searchFood(query, page)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
