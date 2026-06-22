import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/server'

/**
 * GET /api/friends/search?q=username&tg_id=123
 * Searches users by username (partial match), excludes self and existing friends.
 * Returns up to 10 results.
 */
export async function GET(request: NextRequest) {
  let q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const tg_id = request.nextUrl.searchParams.get('tg_id')

  if (q.startsWith('@')) {
    q = q.substring(1)
  }

  if (!q || q.length < 2) {
    return NextResponse.json({ users: [] })
  }

  const supabase = await createServerAdminClient()

  // Build base query — search by tg_username OR first_name
  let query = supabase
    .from('users')
    .select('tg_id, first_name, last_name, tg_username, avatar_url, aura_points, aura_level')
    .or(`tg_username.ilike.%${q}%,first_name.ilike.%${q}%`)
    .limit(10)

  // Exclude self
  if (tg_id) {
    query = query.neq('tg_id', parseInt(tg_id))
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If caller provided tg_id, filter out existing friends
  if (tg_id && data && data.length > 0) {
    const { data: existingFriends } = await supabase
      .from('friends')
      .select('friend_id')
      .eq('user_id', parseInt(tg_id))

    const friendSet = new Set((existingFriends ?? []).map((f: { friend_id: number }) => f.friend_id))
    const filtered  = data.filter((u: { tg_id: number }) => !friendSet.has(u.tg_id))

    return NextResponse.json({ users: filtered })
  }

  return NextResponse.json({ users: data ?? [] })
}
