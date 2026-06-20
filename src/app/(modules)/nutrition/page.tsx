'use client'

import { NutritionTracker } from '@/components/nutrition/NutritionTracker'
import { useTelegram } from '@/hooks/useTelegram'
import { useAppStore } from '@/store/useAppStore'
import { calculateTdee } from '@/lib/nutrition/tdee'

export default function NutritionPage() {
  const { haptic } = useTelegram()
  const { dbUser, macros } = useAppStore()

  // ── Daily targets from user profile (Global macros > calculateTdee > fallback) ──
  let targetKcal = 2000, targetP = 150, targetC = 250, targetF = 65

  if (macros) {
    targetKcal = macros.targetCalories
    targetP = macros.macros.protein
    targetC = macros.macros.carbs
    targetF = macros.macros.fat
  } else if (dbUser?.age && dbUser.gender && dbUser.height_cm && dbUser.weight_kg) {
    const tdeeTarget = calculateTdee({
      age: dbUser.age,
      gender: dbUser.gender as 'male' | 'female',
      heightCm: dbUser.height_cm,
      weightKg: Number(dbUser.weight_kg),
      activityLevel: dbUser.activity_level as Parameters<typeof calculateTdee>[0]['activityLevel'],
      goal: 'maintain',
    })
    targetKcal = tdeeTarget.target
    targetP = tdeeTarget.protein
    targetC = tdeeTarget.carbs
    targetF = tdeeTarget.fat
  }

  return (
    <div className="page-enter min-h-full pb-28">
      {/* Header */}
      <div className="px-4 pt-8 pb-5">
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">МОДУЛЬ</p>
        <h1 className="text-2xl font-black text-zinc-100">
          NUTRI<span className="text-zinc-400">CLEAN</span>
        </h1>
      </div>

      {/* Tracker */}
      <div className="px-4">
        <NutritionTracker
          calorieTarget={targetKcal}
          proteinTarget={targetP}
          carbsTarget={targetC}
          fatTarget={targetF}
          onEntryAdded={() => haptic.success()}
        />
      </div>
    </div>
  )
}
