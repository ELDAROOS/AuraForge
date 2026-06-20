import type { FoodItem } from '@/types/nutrition'

// ─── Local Database ───────────────────────────────────────────────
// A small collection of foundational whole foods that are often hard
// to find accurately via general APIs due to brand clutter.
export const LOCAL_FOOD_DB: Omit<FoodItem, 'source'>[] = [
  {
    barcode: 'local_egg_chicken',
    name: 'Яйцо куриное (целое)',
    brand: null,
    imageUrl: null,
    per100g: { calories: 155, protein: 12.6, carbs: 0.7, fat: 10.6, fiber: 0 },
    servingSize: null
  },
  {
    barcode: 'local_chicken_breast_raw',
    name: 'Куриное филе (сырое)',
    brand: null,
    imageUrl: null,
    per100g: { calories: 110, protein: 23.1, carbs: 0, fat: 1.2, fiber: 0 },
    servingSize: null
  },
  {
    barcode: 'local_chicken_breast_cooked',
    name: 'Куриное филе (отварное/запеченное)',
    brand: null,
    imageUrl: null,
    per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
    servingSize: null
  },
  {
    barcode: 'local_buckwheat_raw',
    name: 'Гречка (сухая)',
    brand: null,
    imageUrl: null,
    per100g: { calories: 343, protein: 13.2, carbs: 71.5, fat: 3.4, fiber: 10 },
    servingSize: null
  },
  {
    barcode: 'local_buckwheat_cooked',
    name: 'Гречка (отварная)',
    brand: null,
    imageUrl: null,
    per100g: { calories: 92, protein: 3.4, carbs: 20, fat: 1, fiber: 2.7 },
    servingSize: null
  },
  {
    barcode: 'local_rice_white_raw',
    name: 'Рис белый (сухой)',
    brand: null,
    imageUrl: null,
    per100g: { calories: 360, protein: 7, carbs: 80, fat: 1, fiber: 1 },
    servingSize: null
  },
  {
    barcode: 'local_rice_white_cooked',
    name: 'Рис белый (отварной)',
    brand: null,
    imageUrl: null,
    per100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 },
    servingSize: null
  },
  {
    barcode: 'local_banana',
    name: 'Банан',
    brand: null,
    imageUrl: null,
    per100g: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6 },
    servingSize: null
  },
  {
    barcode: 'local_apple',
    name: 'Яблоко',
    brand: null,
    imageUrl: null,
    per100g: { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4 },
    servingSize: null
  },
  {
    barcode: 'local_cucumber',
    name: 'Огурец',
    brand: null,
    imageUrl: null,
    per100g: { calories: 15, protein: 0.8, carbs: 2.8, fat: 0.1, fiber: 0.5 },
    servingSize: null
  },
  {
    barcode: 'local_tomato',
    name: 'Помидор',
    brand: null,
    imageUrl: null,
    per100g: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2 },
    servingSize: null
  },
  {
    barcode: 'local_cottage_cheese_5',
    name: 'Творог 5%',
    brand: null,
    imageUrl: null,
    per100g: { calories: 121, protein: 21.2, carbs: 1.5, fat: 5, fiber: 0 },
    servingSize: null
  },
  {
    barcode: 'local_cottage_cheese_0',
    name: 'Творог обезжиренный',
    brand: null,
    imageUrl: null,
    per100g: { calories: 71, protein: 16.5, carbs: 1.3, fat: 0, fiber: 0 },
    servingSize: null
  },
  {
    barcode: 'local_potato_raw',
    name: 'Картофель (сырой)',
    brand: null,
    imageUrl: null,
    per100g: { calories: 77, protein: 2, carbs: 17.5, fat: 0.1, fiber: 2.2 },
    servingSize: null
  },
  {
    barcode: 'local_potato_cooked',
    name: 'Картофель (отварной)',
    brand: null,
    imageUrl: null,
    per100g: { calories: 86, protein: 2, carbs: 20, fat: 0.1, fiber: 1.8 },
    servingSize: null
  },
  {
    barcode: 'local_oatmeal',
    name: 'Овсянка (сухая)',
    brand: null,
    imageUrl: null,
    per100g: { calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9, fiber: 10.6 },
    servingSize: null
  },
  {
    barcode: 'local_olive_oil',
    name: 'Оливковое масло',
    brand: null,
    imageUrl: null,
    per100g: { calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0 },
    servingSize: null
  },
  {
    barcode: 'local_butter',
    name: 'Сливочное масло 82.5%',
    brand: null,
    imageUrl: null,
    per100g: { calories: 748, protein: 0.5, carbs: 0.8, fat: 82.5, fiber: 0 },
    servingSize: null
  },
  {
    barcode: 'local_almond',
    name: 'Миндаль',
    brand: null,
    imageUrl: null,
    per100g: { calories: 579, protein: 21.2, carbs: 21.6, fat: 49.9, fiber: 12.5 },
    servingSize: null
  },
  {
    barcode: 'local_walnut',
    name: 'Грецкий орех',
    brand: null,
    imageUrl: null,
    per100g: { calories: 654, protein: 15.2, carbs: 13.7, fat: 65.2, fiber: 6.7 },
    servingSize: null
  }
]

export function searchLocalFood(query: string): FoodItem[] {
  const q = query.toLowerCase().trim()
  return LOCAL_FOOD_DB
    .filter(item => item.name.toLowerCase().includes(q))
    .map(item => ({ ...item, source: 'local' }))
}
