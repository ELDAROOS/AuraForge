'use client'

import { useEffect } from 'react'
import { useTelegram } from '@/hooks/useTelegram'
import { useAppStore } from '@/store/useAppStore'

interface TelegramProviderProps {
  children: React.ReactNode
}

/**
 * Инициализирует Telegram WebApp и синхронизирует пользователя с БД.
 * Оборачивает всё приложение.
 */
export function TelegramProvider({ children }: TelegramProviderProps) {
  const { user, isReady, colorScheme } = useTelegram()
  const { setTgUser, setDbUser, setLoading } = useAppStore()

  useEffect(() => {
    if (!isReady) return

    // Применяем тему Telegram как data-атрибут для CSS
    document.documentElement.setAttribute('data-theme', colorScheme)

    if (user) {
      setTgUser(user)

      // Upsert пользователя в БД
      fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tg_id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          tg_username: user.username,
          avatar_url: user.photo_url,
        }),
      })
        .then((r) => r.json())
        .then(({ user: dbUser }) => {
          if (dbUser) setDbUser(dbUser)
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      // Для разработки вне Telegram — создаём тестового пользователя
      if (process.env.NODE_ENV === 'development') {
        fetch('/api/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tg_id: 999999999,
            first_name: 'Dev',
            last_name: 'User',
            tg_username: 'devuser',
          }),
        })
          .then((r) => r.json())
          .then(({ user: dbUser }) => { if (dbUser) setDbUser(dbUser) })
          .finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    }
  }, [isReady, user, colorScheme, setTgUser, setDbUser, setLoading])

  return <>{children}</>
}
