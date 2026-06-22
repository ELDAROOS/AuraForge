import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/server'

const BUCKET = 'avatars'
const MAX_SIZE_BYTES = 3 * 1024 * 1024 // 3MB

/**
 * POST /api/upload-avatar
 * Accepts multipart/form-data: { file: File, tg_id: string }
 * Uploads to Supabase Storage `avatars` bucket.
 * Updates users.avatar_url in the database.
 * Returns: { avatar_url: string, user: DbUser }
 */
export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file   = formData.get('file') as File | null
  const tg_id  = formData.get('tg_id') as string | null

  if (!file || !tg_id) {
    return NextResponse.json({ error: 'file and tg_id are required' }, { status: 400 })
  }

  // ── Validate ──────────────────────────────────────────────────────
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File too large (max 3MB)' }, { status: 400 })
  }

  const supabase = await createServerAdminClient()

  // ── Verify user exists ───────────────────────────────────────────
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, tg_id')
    .eq('tg_id', parseInt(tg_id))
    .single()

  if (userError || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // ── Upload to Storage ────────────────────────────────────────────
  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${user.id}/avatar.${ext}`       // one file per user — auto-replaces

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,          // overwrite existing avatar
      cacheControl: '3600',
    })

  if (uploadError) {
    console.error('[upload-avatar] Storage upload failed:', uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // ── Build public URL ─────────────────────────────────────────────
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path)

  // Add cache-buster so the browser reloads the image after replace
  const avatar_url = `${urlData.publicUrl}?t=${Date.now()}`

  // ── Update users table ───────────────────────────────────────────
  const { data: updated, error: updateError } = await supabase
    .from('users')
    .update({ avatar_url, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select()
    .single()

  if (updateError) {
    console.error('[upload-avatar] DB update failed:', updateError)
    // Storage upload succeeded; return partial success
    return NextResponse.json({ avatar_url, user: null, warning: 'DB not updated' })
  }

  return NextResponse.json({ avatar_url, user: updated })
}
