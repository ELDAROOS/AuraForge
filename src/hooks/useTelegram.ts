'use client'

import { useEffect, useState } from 'react'
import { TelegramUser, TelegramWebApp } from '@/types/telegram'
import { applyTelegramTheme, isTelegramWebApp } from '@/lib/telegram/theme'

interface UseTelegramReturn {
  webApp: TelegramWebApp | null
  user: TelegramUser | null
  /** Alias for user — for components that prefer tgUser */
  tgUser: TelegramUser | null
  colorScheme: 'light' | 'dark'
  isReady: boolean
  isInsideTelegram: boolean
  haptic: {
    light: () => void
    medium: () => void
    heavy: () => void
    success: () => void
    error: () => void
    warning: () => void
  }
}

export function useTelegram(): UseTelegramReturn {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg) {
      setTimeout(() => setIsReady(true), 0)
      return
    }

    tg.ready()
    tg.expand()

    if (tg.themeParams) {
      applyTelegramTheme(tg.themeParams)
    }

    setTimeout(() => {
      setWebApp(tg)
      setIsReady(true)
    }, 0)
  }, [])

  const haptic = {
    light: () => webApp?.HapticFeedback.impactOccurred('light'),
    medium: () => webApp?.HapticFeedback.impactOccurred('medium'),
    heavy: () => webApp?.HapticFeedback.impactOccurred('heavy'),
    success: () => webApp?.HapticFeedback.notificationOccurred('success'),
    error: () => webApp?.HapticFeedback.notificationOccurred('error'),
    warning: () => webApp?.HapticFeedback.notificationOccurred('warning'),
  }

  return {
    webApp,
    user: webApp?.initDataUnsafe?.user ?? null,
    tgUser: webApp?.initDataUnsafe?.user ?? null,
    colorScheme: webApp?.colorScheme ?? 'dark',
    isReady,
    isInsideTelegram: isTelegramWebApp(),
    haptic,
  }
}
