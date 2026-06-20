import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/server'
import { calculateAuraLevel } from '@/lib/nutrition/tdee'

/**
 * POST /api/logs
 * Logs habit completion and awards XP.
 * Body: { tg_id, habit_id, status, note?, duration_sec? }
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { tg_id, habit_id, status = 'completed', note, duration_sec } = body

  if (!tg_id || !habit_id) {
    return NextResponse.json({ error: 'tg_id and habit_id are required' }, { status: 400 })
  }

  const supabase = await createServerAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Get user + habit
  const [{ data: user }, { data: habit }] = await Promise.all([
    supabase.from('users').select('id, aura_points, aura_level, current_streak, last_active_date').eq('tg_id', tg_id).single(),
    supabase.from('habits').select('xp_reward, xp_penalty').eq('id', habit_id).single(),
  ])

  if (!user || !habit) return NextResponse.json({ error: 'User or habit not found' }, { status: 404 })

  const xpEarned = status === 'completed' ? habit.xp_reward : -habit.xp_penalty

  // Upsert log (один лог в день)
  const { data: log, error: logError } = await supabase
    .from('habit_logs')
    .upsert(
      { habit_id, user_id: user.id, log_date: today, status, xp_earned: xpEarned, note, duration_sec },
      { onConflict: 'habit_id,log_date' }
    )
    .select()
    .single()

  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })

  // Update user XP + streak
  const newPoints = Math.max(0, user.aura_points + xpEarned)
  const newLevel = calculateAuraLevel(newPoints)

  const isConsecutiveDay =
    user.last_active_date === new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const newStreak = isConsecutiveDay ? user.current_streak + 1 : 1

  await Promise.all([
    supabase.from('users').update({
      aura_points: newPoints,
      aura_level: newLevel,
      current_streak: newStreak,
      last_active_date: today,
    }).eq('id', user.id),

    supabase.from('aura_transactions').insert({
      user_id: user.id,
      amount: xpEarned,
      reason: `habit_${status}`,
      reference_id: log.id,
      balance_after: newPoints,
    }),
  ])

  return NextResponse.json({
    log,
    aura: { points: newPoints, level: newLevel, streak: newStreak, xpEarned },
  })
}
