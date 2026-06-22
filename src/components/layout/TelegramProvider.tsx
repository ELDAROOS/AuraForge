'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { TelegramUser } from '@/types/telegram'
import { LoginScreen } from './LoginScreen'

/**
 * Инициализирует Telegram WebApp SDK, регистрирует пользователя в Supabase
 * и обрабатывает invite-параметр из deep link (startapp=invite_ID).
 * Если запущено вне Telegram, показывает виджет Login with Telegram.
 */
export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const { setTgUser, setDbUser, setLoading } = useAppStore()
  const initialized = useRef(false)
  const [requireLogin, setRequireLogin] = useState(false)

  const processUserAuth = async (tgUser: TelegramUser, isFromWebLogin: boolean = false) => {
    setTgUser(tgUser)

    if (isFromWebLogin) {
      localStorage.setItem('auraforge_tg_user', JSON.stringify(tgUser))
    }

    try {
      const resp = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tg_id: tgUser.id,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name ?? null,
          tg_username: tgUser.username ?? null,
          avatar_url: tgUser.photo_url ?? null,
        }),
      })

      if (resp.ok) {
        const { user: dbUser } = await resp.json()
        if (dbUser) setDbUser(dbUser)
      }
    } catch (err) {
      console.error('[TelegramProvider] User upsert failed:', err)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    async function init() {
      // Пытаемся получить объект Telegram WebApp с небольшим ожиданием
      let tg = window.Telegram?.WebApp
      let retries = 0
      while (!tg && retries < 10) {
        await new Promise(r => setTimeout(r, 100)) // Ждем 100мс
        tg = window.Telegram?.WebApp
        retries++
      }

      if (tg) {
        tg.ready()
        tg.expand()
      }

      // ── 1. Проверяем среду Telegram ──────────────────────────────
      let tgUser: TelegramUser | null = tg?.initDataUnsafe?.user ?? null

      // Иногда initDataUnsafe не сразу готов
      retries = 0
      while (!tgUser && tg?.initDataUnsafe && retries < 10) {
        await new Promise(r => setTimeout(r, 100))
        tgUser = tg.initDataUnsafe.user ?? null
        retries++
      }

      // ── 2. Если не в Telegram, ищем локальную сессию ──────────
      if (!tgUser) {
        const storedUser = localStorage.getItem('auraforge_tg_user')
        if (storedUser) {
          try {
            tgUser = JSON.parse(storedUser)
          } catch (e) {}
        }
      }

      // ── 3. Обработка DevMode ─────────────────────────────────────
      const devMode = process.env.NODE_ENV === 'development' && !tgUser
      if (devMode) {
        tgUser = {
          id: 999999999,
          first_name: 'Dev',
          last_name: 'User',
          username: 'devuser',
        } as TelegramUser
      }

      // ── 4. Если юзера всё ещё нет — показываем экран входа ─────
      if (!tgUser) {
        setRequireLogin(true)
        setLoading(false)
        return
      }

      await processUserAuth(tgUser, false)

      // ── 5. Обработка invite-ссылки ──────────────────────────────
      const startParam = tg?.initDataUnsafe?.start_param
      if (startParam?.startsWith('invite_')) {
        const referrerId = parseInt(startParam.replace('invite_', ''), 10)
        if (!isNaN(referrerId) && referrerId !== tgUser.id) {
          try {
            await fetch('/api/friends', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_tg_id: tgUser.id,
                friend_tg_id: referrerId,
              }),
            })
          } catch (err) {
            console.error('[TelegramProvider] Friend invite failed:', err)
          }
        }
      }
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (requireLogin) {
    return (
      <LoginScreen 
        onLogin={async (user) => {
          setRequireLogin(false)
          setLoading(true)
          await processUserAuth(user, true)
        }} 
      />
    )
  }

  return <>{children}</>
}
