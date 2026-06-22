import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/server'

/**
 * GET /api/friends?tg_id=123
 * Returns friends list with their stats, sorted by aura_points desc.
 */
export async function GET(request: NextRequest) {
  const tgId = request.nextUrl.searchParams.get('tg_id')
  if (!tgId) return NextResponse.json({ error: 'tg_id is required' }, { status: 400 })

  const supabase = await createServerAdminClient()

  // Get all friends' tg_ids
  const { data: friendRows, error: friendsError } = await supabase
    .from('friends')
    .select('friend_id')
    .eq('user_id', parseInt(tgId))

  if (friendsError) return NextResponse.json({ error: friendsError.message }, { status: 500 })

  if (!friendRows || friendRows.length === 0) {
    return NextResponse.json({ friends: [] })
  }

  const friendIds = friendRows.map((r: { friend_id: number }) => r.friend_id)

  // Fetch friend profiles
  const { data: friends, error: usersError } = await supabase
    .from('users')
    .select('tg_id, first_name, last_name, avatar_url, aura_points, aura_level, current_streak, last_active_date')
    .in('tg_id', friendIds)
    .order('aura_points', { ascending: false })

  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })

  return NextResponse.json({ friends: friends ?? [] })
}

/**
 * POST /api/friends
 * Add a friend by their tg_id (invite link flow).
 * Body: { user_tg_id, friend_tg_id }
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { user_tg_id, friend_tg_id } = body

  if (!user_tg_id || !friend_tg_id) {
    return NextResponse.json({ error: 'user_tg_id and friend_tg_id are required' }, { status: 400 })
  }
  if (user_tg_id === friend_tg_id) {
    return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 })
  }

  const supabase = await createServerAdminClient()

  // Verify users exist first (to avoid foreign key errors if they haven't synced yet)
  const { data: usersCount } = await supabase
    .from('users')
    .select('tg_id')
    .in('tg_id', [user_tg_id, friend_tg_id])

  if (!usersCount || usersCount.length < 2) {
    return NextResponse.json({ error: 'One or both users do not exist' }, { status: 404 })
  }

  // Insert bidirectional friendship
  const { error } = await supabase.from('friends').insert([
    { user_id: user_tg_id, friend_id: friend_tg_id },
    { user_id: friend_tg_id, friend_id: user_tg_id },
  ])

  // Ignore unique constraint violation (they are already friends)
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
