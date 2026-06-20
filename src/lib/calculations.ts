export type Gender = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete'
export type Goal = 'lose' | 'maintain' | 'gain' | 'skin'

export interface MacroResult {
  bmr: number
  tdee: number
  targetCalories: number
  macros: {
    protein: number
    fat: number
    carbs: number
  }
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
}

const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  lose: -0.20,     // 20% deficit
  maintain: 0,     // 0%
  gain: +0.15,     // 15% surplus
  skin: 0,         // maintenance
}

export function calculateMacros(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  gender: Gender,
  activity: ActivityLevel,
  goal: Goal
): MacroResult {
  // 1. Mifflin-St Jeor BMR
  let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears)
  if (gender === 'male') {
    bmr += 5
  } else {
    bmr -= 161
  }
  
  // 2. TDEE
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activity]
  
  // 3. Goal adjusted calories
  const targetCalories = tdee * (1 + GOAL_ADJUSTMENTS[goal])
  
  // 4. Macros
  const proteinGrams = Math.round(weightKg * 2)
  const fatGrams = Math.round(weightKg * 1)
  
  const proteinKcal = proteinGrams * 4
  const fatKcal = fatGrams * 9
  
  const remainingKcal = targetCalories - proteinKcal - fatKcal
  // Prevent negative carbs if deficit is too aggressive
  const carbsGrams = Math.max(0, Math.round(remainingKcal / 4))

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories: Math.round(targetCalories),
    macros: {
      protein: proteinGrams,
      fat: fatGrams,
      carbs: carbsGrams,
    }
  }
}
