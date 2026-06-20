import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { BottomNav } from '@/components/layout/BottomNav'
import { TelegramProvider } from '@/components/layout/TelegramProvider'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AuraForge — Твой глоу-ап',
  description: 'Комплексное приложение для улучшения внешности: уход за кожей, тренировки, питание и прокачка ауры.',
  keywords: ['looksmaxxing', 'глоу-ап', 'мьюинг', 'скинкер', 'аура', 'биохакинг'],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <TelegramProvider>
          <div className="app-shell">
            <main className="main-content">
              {children}
            </main>
            <BottomNav />
          </div>
        </TelegramProvider>
      </body>
    </html>
  )
}
