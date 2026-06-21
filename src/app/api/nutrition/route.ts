import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/server'

/**
 * GET /api/nutrition?tg_id=123&date=2024-01-15
 * Returns today's nutrition logs for a user.
 */
export async function GET(request: NextRequest) {
  const tgId = request.nextUrl.searchParams.get('tg_id')
  const date =
    request.nextUrl.searchParams.get('date') ??
    new Date().toISOString().split('T')[0]

  if (!tgId) {
    return NextResponse.json({ error: 'tg_id is required' }, { status: 400 })
  }

  const supabase = await createServerAdminClient()

  // Resolve internal user.id from tg_id
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('tg_id', parseInt(tgId))
    .single()

  if (userError || !user) {
    return NextResponse.json({ logs: [] })
  }

  const { data: logs, error } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('log_date', date)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[GET /api/nutrition] query failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ logs: logs ?? [] })
}

/**
 * POST /api/nutrition
 * Inserts a new nutrition log entry.
 *
 * Body: {
 *   tg_id, food_name, barcode?, amount_g,
 *   calories, protein_g, carbs_g, fat_g, fiber_g?,
 *   meal_type?
 * }
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    tg_id,
    food_name,
    barcode = null,
    amount_g,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g = null,
    meal_type = null,
  } = body as {
    tg_id: number
    food_name: string
    barcode?: string | null
    amount_g: number
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g?: number | null
    meal_type?: string | null
  }

  if (!tg_id || !food_name || !amount_g) {
    return NextResponse.json(
      { error: 'tg_id, food_name and amount_g are required' },
      { status: 400 }
    )
  }

  const supabase = await createServerAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Resolve user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('tg_id', tg_id)
    .single()

  if (userError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: log, error: insertError } = await supabase
    .from('nutrition_logs')
    .insert({
      user_id: user.id,
      log_date: today,
      food_name,
      barcode,
      amount_g,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g,
      meal_type,
    })
    .select()
    .single()

  if (insertError) {
    console.error('[POST /api/nutrition] insert failed:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ log })
}

/**
 * DELETE /api/nutrition?id={log_id}&tg_id={tg_id}
 * Deletes a nutrition log entry (ownership check via tg_id).
 */
export async function DELETE(request: NextRequest) {
  const logId = request.nextUrl.searchParams.get('id')
  const tgId = request.nextUrl.searchParams.get('tg_id')

  if (!logId || !tgId) {
    return NextResponse.json({ error: 'id and tg_id are required' }, { status: 400 })
  }

  const supabase = await createServerAdminClient()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('tg_id', parseInt(tgId))
    .single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { error } = await supabase
    .from('nutrition_logs')
    .delete()
    .eq('id', logId)
    .eq('user_id', user.id)   // ownership guard

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
