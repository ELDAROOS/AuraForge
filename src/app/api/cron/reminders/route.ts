import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface InactiveUser {
  tg_id: number
  first_name: string
  current_streak: number
}

interface SendResult {
  tg_id: number
  ok: boolean
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Supabase admin client — bypasses RLS, safe for server-only cron routes */
function createAdminClient() {
  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    // Cron routes have no cookies — pass no-op handlers
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

/**
 * Build the Telegram sendMessage payload.
 *
 * InlineKeyboardMarkup → web_app button opens our Mini App.
 * This satisfies the Telegram Bot API requirement for WebApps:
 * https://core.telegram.org/bots/api#inlinekeyboardbutton
 */
function buildTelegramPayload(chatId: number, firstName: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://auraforge.app'

  return {
    chat_id: chatId,
    parse_mode: 'HTML',
    text: [
      `⚡️ <b>${firstName}, твоя Аура падает.</b>`,
      '',
      'Ты сегодня не выполнил норму.',
      'Зайди на 5 минут и сохрани свой стрик — пока не поздно.',
      '',
      `🔥 Текущая серия под угрозой.`,
    ].join('\n'),
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '⚡️ Открыть AuraForge',
            web_app: { url: appUrl },
          },
        ],
      ],
    },
  }
}

/**
 * Send a single Telegram message.
 * Returns { ok, error? }.
 */
async function sendTelegramMessage(
  token: string,
  payload: ReturnType<typeof buildTelegramPayload>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )
    const json = (await res.json()) as { ok: boolean; description?: string }
    return json.ok ? { ok: true } : { ok: false, error: json.description }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

/**
 * Telegram rate limit: max 30 messages/second globally.
 * We use a conservative 40 ms gap (≈ 25 msg/s) so we stay safely under the
 * limit even if the bot sends to other chats concurrently.
 */
const TELEGRAM_SEND_DELAY_MS = 40

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────────────────────────────────────
// Query: find users who have NOT completed any habit today
// ─────────────────────────────────────────────────────────────────────────────

async function fetchInactiveUsers(todayDate: string): Promise<InactiveUser[]> {
  const supabase = createAdminClient()

  /**
   * Strategy:
   *   1. Get all users who have at least one active habit.
   *   2. Exclude users who have at least one habit_log with status='completed'
   *      for today.
   *
   * We use a Postgres NOT IN sub-select expressed through Supabase's
   * PostgREST filter.  Because PostgREST doesn't support nested NOT EXISTS
   * natively, we:
   *   a) Fetch user_ids that DID log something today.
   *   b) Filter users WHERE id NOT IN that set.
   */

  // a) Users who already completed ≥1 habit today
  const { data: activeLogs } = await supabase
    .from('habit_logs')
    .select('user_id')
    .eq('log_date', todayDate)
    .eq('status', 'completed')

  const activeUserIds: string[] =
    activeLogs?.map((l: { user_id: string }) => l.user_id) ?? []

  // b) All users who registered and are NOT in the active set.
  // We cast to `any` to break the excessively-deep Supabase generic inference
  // chain that triggers TS2589 when conditionally chaining .not() calls.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('users')
    .select('tg_id, first_name, current_streak')
    // Only notify users who opened the app at least once (have a last_active_date)
    .not('last_active_date', 'is', null)

  if (activeUserIds.length > 0) {
    // PostgREST: filter NOT IN list
    query = query.not('id', 'in', `(${activeUserIds.join(',')})`)
  }

  const { data: users, error } = await query

  if (error) {
    console.error('[cron/reminders] Supabase query failed:', error.message)
    return []
  }

  return (users ?? []) as InactiveUser[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/cron/reminders
 *
 * Triggered by Vercel Cron at 20:00 UTC+5 (15:00 UTC) every day.
 *
 * Security: Vercel automatically injects the CRON_SECRET as a Bearer token
 * in the Authorization header. We validate it before doing any work.
 * See: https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
 */
export async function GET(request: NextRequest) {
  // ── 1. Authorise ────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/reminders] CRON_SECRET env var is not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Validate bot token ────────────────────────────────────────
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.error('[cron/reminders] TELEGRAM_BOT_TOKEN env var is not set')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  // ── 3. Determine today's date (UTC) ─────────────────────────────
  const todayDate = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // ── 4. Query inactive users ──────────────────────────────────────
  const inactiveUsers = await fetchInactiveUsers(todayDate)

  console.log(
    `[cron/reminders] ${todayDate}: found ${inactiveUsers.length} inactive user(s)`
  )

  if (inactiveUsers.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Everyone is on track today 💪' })
  }

  // ── 5. Send notifications with rate-limit protection ─────────────
  const results: SendResult[] = []

  for (const user of inactiveUsers) {
    const payload = buildTelegramPayload(user.tg_id, user.first_name)
    const { ok, error } = await sendTelegramMessage(botToken, payload)

    results.push({ tg_id: user.tg_id, ok, error })

    if (!ok) {
      console.warn(
        `[cron/reminders] Failed to send to tg_id=${user.tg_id}: ${error}`
      )
    }

    // Throttle: 40 ms between messages to stay under TG's 30 msg/s global cap
    await sleep(TELEGRAM_SEND_DELAY_MS)
  }

  const successCount = results.filter((r) => r.ok).length
  const failCount = results.length - successCount

  console.log(
    `[cron/reminders] Done. Sent: ${successCount}, Failed: ${failCount}`
  )

  return NextResponse.json({
    date: todayDate,
    total: inactiveUsers.length,
    sent: successCount,
    failed: failCount,
    // Include failures in response for Vercel log inspection
    failures: results.filter((r) => !r.ok),
  })
}
