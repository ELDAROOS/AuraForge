import { NextRequest, NextResponse } from 'next/server'
import { createServerAdminClient } from '@/lib/supabase/server'

/**
 * POST /api/telegram/webhook
 * 
 * Handles incoming updates from Telegram.
 * We primarily listen for the /start command to send a welcome message
 * with an inline keyboard that opens the Web App.
 */
export async function POST(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is missing')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }

  try {
    const update = await request.json()

    // We only care about messages for now
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id
      const text = update.message.text
      const firstName = update.message.from?.first_name || 'Бро'

      // Determine host for Web App URL
      const host = request.headers.get('host')
      const protocol = host?.includes('localhost') ? 'http' : 'https'
      const appUrl = `${protocol}://${host}`

      // Handle Magic Link Login
      if (text.startsWith('/start login_')) {
        const tokenStr = text.replace('/start login_', '').trim()
        
        // 1. Upsert user in database
        const supabase = await createServerAdminClient()
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('tg_id', chatId)
          .single()

        let dbUserId = user?.id
        if (!user) {
          // Create new user
          const { data: newUser } = await supabase.from('users').insert({
            tg_id: chatId,
            first_name: firstName,
            tg_username: update.message.from?.username || null
          }).select('id').single()
          dbUserId = newUser?.id
        } else {
          // Update existing user info
          await supabase.from('users').update({
            first_name: firstName,
            tg_username: update.message.from?.username || null
          }).eq('id', dbUserId)
        }

        // 2. Save token in aura_transactions as a creative way to pass data without new tables
        if (dbUserId) {
          await supabase.from('aura_transactions').insert({
            user_id: dbUserId,
            amount: 0,
            reason: 'auth_token',
            reference_id: tokenStr,
            balance_after: 0
          })
        }

        const successMsg = `
✅ <b>Авторизация успешна!</b>

Я подтвердил твой профиль. Возвращайся в браузер (Safari/Chrome), страница обновится автоматически! ⚡️
        `.trim()

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: successMsg,
            parse_mode: 'HTML'
          })
        })
      }
      else if (text.startsWith('/start')) {
        const welcomeMessage = `
Привет, <b>${firstName}</b>! ⚡️

Добро пожаловать в <b>AuraForge</b> — ультимативный трекер привычек, биометрии и тренировок.

Твоя задача — прокачивать уровень и зарабатывать XP за уход, упражнения и поддержание стрика.

Нажми на кнопку ниже, чтобы войти в приложение и проверить свою Ауру.
        `.trim()

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: welcomeMessage,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '⚡️ ОТКРЫТЬ AURAFORGE',
                    web_app: { url: appUrl }
                  }
                ]
              ]
            }
          })
        })
      }
    }

    // Always return 200 OK to Telegram so it stops retrying the webhook
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Webhook error:', error)
    // Return 200 even on error to prevent Telegram from spamming retries for malformed messages
    return NextResponse.json({ ok: true })
  }
}
