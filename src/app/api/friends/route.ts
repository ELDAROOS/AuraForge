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

  // 1. Get all users I added
  const { data: iAddedRows, error: iAddedError } = await supabase
    .from('friends')
    .select('friend_id')
    .eq('user_id', parseInt(tgId))

  if (iAddedError) return NextResponse.json({ error: iAddedError.message }, { status: 500 })

  // 2. Get all users who added me
  const { data: addedMeRows, error: addedMeError } = await supabase
    .from('friends')
    .select('user_id')
    .eq('friend_id', parseInt(tgId))

  if (addedMeError) return NextResponse.json({ error: addedMeError.message }, { status: 500 })

  const iAddedSet = new Set((iAddedRows ?? []).map(r => r.friend_id))
  
  const mutualIds: number[] = []
  const incomingIds: number[] = []

  // Check who added me: if I also added them -> mutual. Else -> incoming request.
  for (const row of (addedMeRows ?? [])) {
    if (iAddedSet.has(row.user_id)) {
      mutualIds.push(row.user_id)
    } else {
      incomingIds.push(row.user_id)
    }
  }

  // Also, what if I added someone but they haven't added me back? (Outgoing requests)
  // The user only cares about seeing mutual friends in the leaderboard, and incoming requests to accept.
  // We won't fetch outgoing for now unless needed.

  const allIdsToFetch = Array.from(new Set([...mutualIds, ...incomingIds]))

  if (allIdsToFetch.length === 0) {
    return NextResponse.json({ friends: [], incomingRequests: [] })
  }

  // Fetch profiles
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('tg_id, first_name, last_name, avatar_url, aura_points, aura_level, current_streak, last_active_date')
    .in('tg_id', allIdsToFetch)

  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })

  const friends = (users ?? []).filter(u => mutualIds.includes(u.tg_id))
    .sort((a, b) => b.aura_points - a.aura_points)
  
  const incomingRequests = (users ?? []).filter(u => incomingIds.includes(u.tg_id))

  return NextResponse.json({ friends, incomingRequests })
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

  // Insert one-way friendship (acts as a request, or an acceptance if the other already exists)
  const { error } = await supabase.from('friends').insert([
    { user_id: user_tg_id, friend_id: friend_tg_id }
  ])

  // Ignore unique constraint violation (they are already friends)
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
