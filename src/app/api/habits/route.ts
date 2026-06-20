import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/server'

/**
 * GET /api/habits?tg_id=123&date=2025-01-01
 * Returns habits with today's log status
 */
export async function GET(request: NextRequest) {
  const tgId = request.nextUrl.searchParams.get('tg_id')
  const date = request.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  if (!tgId) return NextResponse.json({ error: 'tg_id is required' }, { status: 400 })

  const supabase = await createServerAdminClient()

  // Get user id from tg_id
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('tg_id', parseInt(tgId))
    .single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Get habits with today's log joined
  const { data: habits, error } = await supabase
    .from('habits')
    .select(`
      *,
      habit_logs!left(id, status, xp_earned, log_date)
    `)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('habit_logs.log_date', date)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ habits: habits ?? [] })
}

/**
 * POST /api/habits
 * Creates a new habit
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { tg_id, ...habitData } = body

  if (!tg_id) return NextResponse.json({ error: 'tg_id is required' }, { status: 400 })

  const supabase = await createServerAdminClient()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('tg_id', tg_id)
    .single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('habits')
    .insert({ ...habitData, user_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ habit: data })
}
