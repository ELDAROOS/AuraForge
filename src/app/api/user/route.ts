import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/server'
import { DbUser } from '@/types/database'

// ─── Default habits for new users ────────────────────────────
const DEFAULT_HABITS = [
  { title: 'Умывание утром', module: 'face', time_of_day: 'morning', icon_emoji: '🫧', xp_reward: 5 },
  { title: 'Увлажнение лица', module: 'face', time_of_day: 'morning', icon_emoji: '💧', xp_reward: 5 },
  { title: 'Мьюинг (10 мин)', module: 'face', time_of_day: 'anytime', icon_emoji: '💪', xp_reward: 15 },
  { title: 'Вечерний уход', module: 'face', time_of_day: 'evening', icon_emoji: '🌙', xp_reward: 10 },
  { title: 'Тренировка', module: 'body', time_of_day: 'anytime', icon_emoji: '🏋️', xp_reward: 25 },
  { title: 'Проверка осанки', module: 'body', time_of_day: 'anytime', icon_emoji: '🧍', xp_reward: 10 },
  { title: 'Выпить 2л воды', module: 'nutrition', time_of_day: 'anytime', icon_emoji: '💦', xp_reward: 10 },
  { title: 'Дневник питания', module: 'nutrition', time_of_day: 'anytime', icon_emoji: '🥗', xp_reward: 10 },
] as const

/**
 * GET /api/user?tg_id=123456
 * Returns user profile or 404
 */
export async function GET(request: NextRequest) {
  const tgId = request.nextUrl.searchParams.get('tg_id')
  if (!tgId) return NextResponse.json({ error: 'tg_id is required' }, { status: 400 })

  const supabase = await createServerAdminClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('tg_id', parseInt(tgId))
    .single()

  if (error || !data) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json({ user: data })
}

/**
 * POST /api/user
 * Upserts user by tg_id. Creates default habits on first registration.
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { tg_id, first_name, last_name, tg_username, avatar_url } = body

  if (!tg_id || !first_name) {
    return NextResponse.json({ error: 'tg_id and first_name are required' }, { status: 400 })
  }

  const supabase = await createServerAdminClient()

  // Upsert пользователя
  const { data: user, error } = await supabase
    .from('users')
    .upsert(
      { tg_id, first_name, last_name, tg_username, avatar_url },
      { onConflict: 'tg_id', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (error || !user) {
    return NextResponse.json({ error: error?.message ?? 'Failed to upsert user' }, { status: 500 })
  }

  // Если новый пользователь — создаём дефолтные привычки
  const { count } = await supabase
    .from('habits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (count === 0) {
    const habitsToInsert = DEFAULT_HABITS.map((h, i) => ({
      ...h,
      user_id: user.id,
      sort_order: i,
      xp_penalty: 0,
      frequency: 'daily' as const,
      is_active: true,
      description: null,
    }))

    await supabase.from('habits').insert(habitsToInsert)
  }

  return NextResponse.json({ user: user as DbUser })
}

/**
 * PATCH /api/user
 * Updates user profile (physical params, etc.)
 */
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { tg_id, ...updates } = body

  if (!tg_id) return NextResponse.json({ error: 'tg_id is required' }, { status: 400 })

  const supabase = await createServerAdminClient()
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('tg_id', tg_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ user: data })
}
