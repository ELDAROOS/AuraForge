import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/server'
import { calculateAuraLevel } from '@/lib/nutrition/tdee'

/**
 * POST /api/xp
 * Generic endpoint to add (or subtract) XP and record a transaction.
 * Use for things like completing a mewing timer or skincare routine,
 * without needing a predefined habit_id.
 *
 * Body: { tg_id: number, amount: number, reason: string }
 */
export async function POST(request: NextRequest) {
  let body: { tg_id?: number, amount?: number, reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tg_id, amount, reason = 'generic_reward' } = body

  if (!tg_id || amount === undefined) {
    return NextResponse.json({ error: 'tg_id and amount are required' }, { status: 400 })
  }

  if (amount === 0) {
    return NextResponse.json({ success: true, message: 'Zero amount' })
  }

  const supabase = await createServerAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // ── 1. Fetch user ──────────────────────────────────────────────
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, aura_points, aura_level, current_streak, last_active_date')
    .eq('tg_id', tg_id)
    .single()

  if (userError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // ── 2. Calculate new points & streak ───────────────────────────
  const newPoints = Math.max(0, (user.aura_points ?? 0) + amount)
  const newLevel  = calculateAuraLevel(newPoints)

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
  const isConsecutive = user.last_active_date === yesterday
  const isSameDay = user.last_active_date === today

  const newStreak = isSameDay
    ? user.current_streak
    : isConsecutive
      ? (user.current_streak ?? 0) + 1
      : 1

  // ── 3. Update User ───────────────────────────────────────────────
  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({
      aura_points: newPoints,
      aura_level: newLevel,
      current_streak: newStreak,
      last_active_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .select()
    .single()

  if (updateError) {
    console.error('[POST /api/xp] users update failed:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // ── 4. Record Transaction ────────────────────────────────────────
  const { error: txError } = await supabase.from('aura_transactions').insert({
    user_id: user.id,
    amount: amount,
    reason: reason,
    balance_after: newPoints,
  })

  if (txError) {
    console.warn('[POST /api/xp] aura_transactions insert failed:', txError)
  }

  return NextResponse.json({ user: updatedUser, tx_recorded: true })
}
