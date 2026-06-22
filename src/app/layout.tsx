import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
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
      <body className={`${inter.variable} font-sans antialiased bg-black`}>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <TelegramProvider>
          {/*
            app-shell: занимает 100% высоты экрана, flex-col.
            main: прокручивается, имеет отступ снизу = высота BottomNav (64px)
            + safe-area-inset-bottom для iPhone.
          */}
          <div className="flex flex-col min-h-screen">
            <main
              className="flex-1 overflow-y-auto"
              style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}
            >
              {children}
            </main>
            <BottomNav />
          </div>
        </TelegramProvider>
      </body>
    </html>
  )
}
