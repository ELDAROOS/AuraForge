import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

  const supabase = await createServerAdminClient()

  // Find the auth token in the aura_transactions table
  const { data: tx, error: txError } = await supabase
    .from('aura_transactions')
    .select('user_id')
    .eq('reason', 'auth_token')
    .eq('reference_id', token)
    .single()

  if (txError || !tx) {
    return NextResponse.json({ status: 'pending' })
  }

  // Found! Fetch the user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('tg_id, first_name, last_name, tg_username, avatar_url')
    .eq('id', tx.user_id)
    .single()

  if (userError || !user) {
    return NextResponse.json({ status: 'pending' })
  }

  // Map to TelegramUser format expected by frontend
  const tgUser = {
    id: user.tg_id,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.tg_username,
    photo_url: user.avatar_url
  }

  return NextResponse.json({ status: 'success', user: tgUser })
}
