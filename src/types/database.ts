// ============================================================
// AuraForge — Database Types (mirrors Supabase schema)
// ============================================================

export type HabitModule = 'face' | 'body' | 'nutrition' | 'general'
export type HabitFrequency = 'daily' | 'weekly' | 'custom'
export type HabitTimeOfDay = 'morning' | 'evening' | 'anytime'
export type LogStatus = 'completed' | 'skipped' | 'partial'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Gender = 'male' | 'female' | 'other'

export interface DbUser {
  id: string
  tg_id: number
  tg_username: string | null
  first_name: string
  last_name: string | null
  avatar_url: string | null

  age: number | null
  gender: Gender | null
  height_cm: number | null
  weight_kg: number | null
  activity_level: ActivityLevel

  aura_points: number
  aura_level: number
  current_streak: number
  longest_streak: number
  last_active_date: string | null

  created_at: string
  updated_at: string
}

export interface DbHabit {
  id: string
  user_id: string

  title: string
  description: string | null
  module: HabitModule
  frequency: HabitFrequency
  time_of_day: HabitTimeOfDay

  xp_reward: number
  xp_penalty: number

  icon_emoji: string
  is_active: boolean
  sort_order: number

  created_at: string
  updated_at: string
}

export interface DbHabitLog {
  id: string
  habit_id: string
  user_id: string

  log_date: string         // YYYY-MM-DD
  status: LogStatus
  xp_earned: number
  note: string | null
  duration_sec: number | null

  created_at: string
}

export interface DbFaceScanResult {
  id: string
  user_id: string

  asymmetry_score: number | null
  jaw_score: number | null
  eye_level_score: number | null
  face_shape: string | null
  landmarks_json: Record<string, unknown> | null

  scanned_at: string
}

export interface DbNutritionLog {
  id: string
  user_id: string

  log_date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null

  food_name: string
  barcode: string | null

  amount_g: number
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null

  created_at: string
}

export interface DbAuraTransaction {
  id: string
  user_id: string

  amount: number
  reason: string
  reference_id: string | null
  balance_after: number

  created_at: string
}

// ─── Supabase Database shape (for createClient generics) ────────────────────
export interface Database {
  public: {
    Tables: {
      users: { Row: DbUser; Insert: Omit<DbUser, 'id' | 'created_at' | 'updated_at'>; Update: Partial<DbUser> }
      habits: { Row: DbHabit; Insert: Omit<DbHabit, 'id' | 'created_at' | 'updated_at'>; Update: Partial<DbHabit> }
      habit_logs: { Row: DbHabitLog; Insert: Omit<DbHabitLog, 'id' | 'created_at'>; Update: Partial<DbHabitLog> }
      face_scan_results: { Row: DbFaceScanResult; Insert: Omit<DbFaceScanResult, 'id'>; Update: Partial<DbFaceScanResult> }
      nutrition_logs: { Row: DbNutritionLog; Insert: Omit<DbNutritionLog, 'id' | 'created_at'>; Update: Partial<DbNutritionLog> }
      aura_transactions: { Row: DbAuraTransaction; Insert: Omit<DbAuraTransaction, 'id' | 'created_at'>; Update: Partial<DbAuraTransaction> }
    }
  }
}
