import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/telegram/setup
 * 
 * Automatically configures the Telegram Bot to:
 * 1. Set the webhook to this Vercel deployment.
 * 2. Set the global Menu Button to open the Web App.
 */
export async function GET(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is missing' }, { status: 500 })
  }

  // Determine the current host dynamically (Vercel domain or ngrok)
  const host = request.headers.get('host')
  const protocol = host?.includes('localhost') ? 'http' : 'https'
  const appUrl = `${protocol}://${host}`
  const webhookUrl = `${appUrl}/api/telegram/webhook`

  try {
    // 1. Set Webhook
    const webhookRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    })
    const webhookData = await webhookRes.json()

    // 2. Set Menu Button (the button next to the input field)
    const menuRes = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: '🚀 ЗАПУСТИТЬ',
          web_app: { url: appUrl }
        }
      })
    })
    const menuData = await menuRes.json()

    return NextResponse.json({
      success: true,
      appUrl,
      webhookUrl,
      telegramResponse: {
        webhook: webhookData,
        menuButton: menuData
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to configure Telegram bot', details: String(error) }, { status: 500 })
  }
}
