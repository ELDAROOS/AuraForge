import { TdeeInput, TdeeResult } from '@/types/nutrition'

/**
 * Рассчитывает BMR по формуле Mifflin-St Jeor (самая точная для практики).
 * Затем умножает на коэффициент активности и корректирует под цель.
 */
export function calculateTdee(input: TdeeInput): TdeeResult {
  const { age, gender, heightCm, weightKg, activityLevel, goal } = input

  // ─── BMR (Mifflin-St Jeor) ───────────────────────────────
  const bmr =
    gender === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161

  // ─── Activity multiplier ──────────────────────────────────
  const activityMultipliers: Record<TdeeInput['activityLevel'], number> = {
    sedentary:   1.2,
    light:       1.375,
    moderate:    1.55,
    active:      1.725,
    very_active: 1.9,
  }
  const tdee = Math.round(bmr * activityMultipliers[activityLevel])

  // ─── Goal adjustment ──────────────────────────────────────
  const goalAdjustment: Record<TdeeInput['goal'], number> = {
    lose:     -500,  // дефицит 500 ккал = ~0.5 кг/неделю
    maintain: 0,
    gain:     +300,  // профицит 300 ккал = ~0.3 кг/неделю
  }
  const target = tdee + goalAdjustment[goal]

  // ─── Macros (стандартное распределение) ───────────────────
  // Белок: 2г/кг тела, Жир: 25% от цели, Углеводы: остаток
  const protein = Math.round(weightKg * 2)
  const fat = Math.round((target * 0.25) / 9)
  const carbs = Math.round((target - protein * 4 - fat * 9) / 4)

  return {
    bmr: Math.round(bmr),
    tdee,
    target,
    protein,
    carbs,
    fat,
  }
}

/**
 * Вычисляет уровень Aura по очкам (логарифмическая прогрессия).
 */
export function calculateAuraLevel(points: number): number {
  if (points <= 0) return 1
  return Math.floor(Math.log2(points / 50 + 1)) + 1
}

/**
 * Очки, нужные для следующего уровня.
 */
export function xpForNextLevel(level: number): number {
  return Math.round(50 * (Math.pow(2, level) - 1))
}
