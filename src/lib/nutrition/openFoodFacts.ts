import type { FoodItem, FoodSearchResult } from '@/types/nutrition'

const BASE_URL = 'https://world.openfoodfacts.org'

// ─── Raw API Response Types ───────────────────────────────────────
interface RawNutriments {
  'energy-kcal_100g'?: number
  'energy-kcal'?: number
  proteins_100g?: number
  carbohydrates_100g?: number
  fat_100g?: number
  fiber_100g?: number
  sugars_100g?: number
  salt_100g?: number
}

interface RawProduct {
  code?: string
  id?: string
  product_name?: string
  product_name_ru?: string
  product_name_en?: string
  brands?: string
  image_url?: string
  image_small_url?: string
  image_thumb_url?: string
  nutriments?: RawNutriments
  serving_size?: string
  quantity?: string
}

interface RawSearchResponse {
  products: RawProduct[]
  count: number
  page: number
  page_count: number
  page_size: number
  skip: number
}

// ─── Normalization ────────────────────────────────────────────────

/**
 * Normalizes a raw product from Open Food Facts into our clean FoodItem shape.
 * Handles missing/undefined fields gracefully.
 */
function normalizeProduct(raw: RawProduct): FoodItem | null {
  const name =
    raw.product_name_ru?.trim() ||
    raw.product_name?.trim() ||
    raw.product_name_en?.trim()

  if (!name) return null  // Skip products without a name

  const n = raw.nutriments ?? {}

  return {
    barcode: raw.code ?? raw.id ?? '',
    name,
    brand: raw.brands?.split(',')[0].trim() || null,
    imageUrl: raw.image_small_url ?? raw.image_thumb_url ?? raw.image_url ?? null,
    per100g: {
      calories: Math.round(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0),
      protein:  Math.round((n.proteins_100g ?? 0) * 10) / 10,
      carbs:    Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
      fat:      Math.round((n.fat_100g ?? 0) * 10) / 10,
      fiber:    Math.round((n.fiber_100g ?? 0) * 10) / 10,
    },
    servingSize: raw.serving_size ?? null,
  }
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Searches Open Food Facts by product name.
 * Returns up to `pageSize` results, filtered to only those with calorie data.
 */
export async function searchFood(
  query: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ items: FoodItem[]; total: number }> {
  if (!query.trim()) return { items: [], total: 0 }

  const url = new URL(`${BASE_URL}/cgi/search.pl`)
  url.searchParams.set('search_terms', query.trim())
  url.searchParams.set('search_simple', '1')
  url.searchParams.set('action', 'process')
  url.searchParams.set('json', '1')
  url.searchParams.set('page', String(page))
  url.searchParams.set('page_size', String(pageSize))
  // Fetch only the fields we actually need (lighter response)
  url.searchParams.set(
    'fields',
    'code,product_name,product_name_ru,product_name_en,brands,image_small_url,image_thumb_url,nutriments,serving_size'
  )
  // Prefer Russian language results when available
  url.searchParams.set('lc', 'ru')

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'AuraForge/1.0 (https://auraforge.vercel.app)' },
    next: { revalidate: 60 },   // Next.js fetch cache: 60 sec
  })

  if (!res.ok) throw new Error(`Open Food Facts error: ${res.status}`)

  const data = (await res.json()) as RawSearchResponse

  const items = (data.products ?? [])
    .map(normalizeProduct)
    .filter((item): item is FoodItem => item !== null && item.per100g.calories > 0)
    .map(item => ({ ...item, source: 'api' as const }))

  return { items, total: data.count ?? 0 }
}

/**
 * Fetches a single product by barcode.
 */
export async function getProductByBarcode(barcode: string): Promise<FoodItem | null> {
  const res = await fetch(`${BASE_URL}/api/v0/product/${barcode}.json`, {
    headers: { 'User-Agent': 'AuraForge/1.0 (https://auraforge.vercel.app)' },
    next: { revalidate: 3600 },
  })

  if (!res.ok) return null

  const data = await res.json() as { status: number; product?: RawProduct }
  if (data.status !== 1 || !data.product) return null

  const normalized = normalizeProduct({ ...data.product, code: barcode })
  return normalized ? { ...normalized, source: 'barcode' } : null
}

/**
 * Calculates nutrition for a given amount of grams.
 */
export function calcNutrition(
  item: FoodItem,
  grams: number
): { calories: number; protein: number; carbs: number; fat: number; fiber: number } {
  const ratio = grams / 100
  return {
    calories: Math.round(item.per100g.calories * ratio),
    protein:  Math.round(item.per100g.protein  * ratio * 10) / 10,
    carbs:    Math.round(item.per100g.carbs    * ratio * 10) / 10,
    fat:      Math.round(item.per100g.fat      * ratio * 10) / 10,
    fiber:    Math.round(item.per100g.fiber    * ratio * 10) / 10,
  }
}
