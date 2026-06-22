import { NextRequest, NextResponse } from 'next/server'

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

      if (text.startsWith('/start')) {
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
