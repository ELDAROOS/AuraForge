// ============================================================
// AuraForge — Open Food Facts API types
// ============================================================

export interface OpenFoodFactsProduct {
  code: string
  product: {
    product_name?: string
    product_name_ru?: string
    brands?: string
    image_url?: string
    image_small_url?: string
    nutriments?: {
      'energy-kcal_100g'?: number
      'energy-kcal_serving'?: number
      proteins_100g?: number
      carbohydrates_100g?: number
      fat_100g?: number
      fiber_100g?: number
      sugars_100g?: number
      salt_100g?: number
    }
    serving_size?: string
    quantity?: string
    categories?: string
    labels?: string
  }
  status: 0 | 1   // 0 = not found, 1 = found
  status_verbose: string
}

export interface FoodSearchResult {
  products: Array<{
    code: string
    product_name?: string
    product_name_ru?: string
    brands?: string
    image_small_url?: string
    nutriments?: OpenFoodFactsProduct['product']['nutriments']
  }>
  count: number
  page: number
  page_count: number
  page_size: number
  skip: number
}

// ─── Normalized food item for our app ───────────────────────
export interface FoodItem {
  barcode: string
  name: string
  brand: string | null
  imageUrl: string | null
  per100g: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
  }
  servingSize: string | null
  source?: 'local' | 'api' | 'barcode'
}

// ─── КБЖУ / TDEE calculation ─────────────────────────────────
export interface TdeeInput {
  age: number
  gender: 'male' | 'female'
  heightCm: number
  weightKg: number
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  goal: 'lose' | 'maintain' | 'gain'
}

export interface TdeeResult {
  bmr: number        // Базовый метаболизм
  tdee: number       // Суточные калории с учётом активности
  target: number     // Целевые калории с учётом цели
  protein: number    // г/день
  carbs: number      // г/день
  fat: number        // г/день
}
