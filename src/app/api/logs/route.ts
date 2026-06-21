import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/server'
import { calculateAuraLevel } from '@/lib/nutrition/tdee'

/**
 * POST /api/logs
 * Logs habit completion and awards XP to the user.
 *
 * Body: { tg_id: number, habit_id: string, status?: 'completed'|'skipped'|'partial', note?: string, duration_sec?: number }
 *
 * Returns: { log, aura: { points, level, streak, xpEarned } }
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tg_id, habit_id, status = 'completed', note, duration_sec } = body as {
    tg_id: number
    habit_id: string
    status?: string
    note?: string
    duration_sec?: number
  }

  if (!tg_id || !habit_id) {
    return NextResponse.json(
      { error: 'tg_id and habit_id are required' },
      { status: 400 }
    )
  }

  const supabase = await createServerAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // ── 1. Получаем пользователя и привычку параллельно ──────────────
  const [userResult, habitResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, aura_points, aura_level, current_streak, last_active_date')
      .eq('tg_id', tg_id)
      .single(),
    supabase
      .from('habits')
      .select('xp_reward, xp_penalty')
      .eq('id', habit_id)
      .single(),
  ])

  if (userResult.error || !userResult.data) {
    console.error('[POST /api/logs] User not found for tg_id:', tg_id, userResult.error)
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }
  if (habitResult.error || !habitResult.data) {
    console.error('[POST /api/logs] Habit not found:', habit_id, habitResult.error)
    return NextResponse.json({ error: 'Habit not found' }, { status: 404 })
  }

  const user = userResult.data
  const habit = habitResult.data

  // ── 2. Считаем XP (отрицательный при skipped) ────────────────────
  const xpEarned =
    status === 'completed'
      ? (habit.xp_reward ?? 10)
      : -(habit.xp_penalty ?? 0)

  // ── 3. Upsert лога (один лог на привычку в день) ─────────────────
  const { data: log, error: logError } = await supabase
    .from('habit_logs')
    .upsert(
      {
        habit_id,
        user_id: user.id,
        log_date: today,
        status,
        xp_earned: xpEarned,
        note: note ?? null,
        duration_sec: duration_sec ?? null,
      },
      { onConflict: 'habit_id,log_date' }
    )
    .select()
    .single()

  if (logError) {
    console.error('[POST /api/logs] habit_logs upsert failed:', logError)
    return NextResponse.json({ error: logError.message }, { status: 500 })
  }

  // ── 4. Пересчитываем очки и уровень ─────────────────────────────
  const newPoints = Math.max(0, (user.aura_points ?? 0) + xpEarned)
  const newLevel = calculateAuraLevel(newPoints)

  // ── 5. Стрик: consecutive days ───────────────────────────────────
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
  const isConsecutive = user.last_active_date === yesterday
  const isSameDay = user.last_active_date === today
  const newStreak = isSameDay
    ? user.current_streak               // уже был сегодня — не сбрасываем
    : isConsecutive
      ? (user.current_streak ?? 0) + 1  // вчера был — продолжаем серию
      : 1                               // пропустил — сброс

  // ── 6. UPDATE users ──────────────────────────────────────────────
  const { error: userUpdateError } = await supabase
    .from('users')
    .update({
      aura_points: newPoints,
      aura_level: newLevel,
      current_streak: newStreak,
      last_active_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (userUpdateError) {
    console.error('[POST /api/logs] users update failed:', userUpdateError)
    // Не возвращаем 500 — лог уже записан, XP просто не обновился
  }

  // ── 7. Запись в aura_transactions (история начислений) ───────────
  const { error: txError } = await supabase.from('aura_transactions').insert({
    user_id: user.id,
    amount: xpEarned,
    reason: `habit_${status}`,
    reference_id: log?.id ?? null,
    balance_after: newPoints,
  })

  if (txError) {
    // Не критично — логируем и продолжаем
    console.warn('[POST /api/logs] aura_transactions insert failed:', txError)
  }

  return NextResponse.json({
    log,
    aura: {
      points: newPoints,
      level: newLevel,
      streak: newStreak,
      xpEarned,
    },
  })
}
