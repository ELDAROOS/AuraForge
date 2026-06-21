'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { TelegramUser } from '@/types/telegram'

/**
 * Инициализирует Telegram WebApp SDK, регистрирует пользователя в Supabase
 * и обрабатывает invite-параметр из deep link (startapp=invite_ID).
 *
 * Рендерит только children — не добавляет никакой разметки.
 */
export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const { setTgUser, setDbUser, setLoading } = useAppStore()
  const initialized = useRef(false)

  useEffect(() => {
    // Запускаем только один раз, даже в StrictMode (двойной вызов)
    if (initialized.current) return
    initialized.current = true

    async function init() {
      // ── 1. Получаем объект WebApp ────────────────────────────────
      const tg = window.Telegram?.WebApp
      if (tg) {
        tg.ready()
        tg.expand()
      }

      // ── 2. Читаем пользователя из initDataUnsafe ─────────────────
      const tgUser: TelegramUser | null = tg?.initDataUnsafe?.user ?? null

      // ── 3. Определяем tg_id: реальный или dev-заглушка ───────────
      const devMode = process.env.NODE_ENV === 'development' && !tgUser
      const tg_id = tgUser?.id ?? (devMode ? 999999999 : null)

      if (!tg_id) {
        // Запущено в браузере вне Telegram и не dev → пропускаем
        setLoading(false)
        return
      }

      if (tgUser) setTgUser(tgUser)

      // ── 4. Upsert пользователя в Supabase ────────────────────────
      try {
        const resp = await fetch('/api/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            tgUser
              ? {
                  tg_id: tgUser.id,
                  first_name: tgUser.first_name,
                  last_name: tgUser.last_name ?? null,
                  tg_username: tgUser.username ?? null,
                  avatar_url: tgUser.photo_url ?? null,
                }
              : {
                  // Dev-заглушка
                  tg_id: 999999999,
                  first_name: 'Dev',
                  last_name: 'User',
                  tg_username: 'devuser',
                }
          ),
        })

        if (resp.ok) {
          const { user: dbUser } = await resp.json()
          if (dbUser) setDbUser(dbUser)
        }
      } catch (err) {
        console.error('[TelegramProvider] User upsert failed:', err)
      }

      // ── 5. Обработка invite-ссылки (startapp=invite_{referrerId}) ─
      // Telegram передаёт параметр через initDataUnsafe.start_param
      const startParam = tg?.initDataUnsafe?.start_param

      if (startParam?.startsWith('invite_')) {
        const referrerId = parseInt(startParam.replace('invite_', ''), 10)

        if (!isNaN(referrerId) && referrerId !== tg_id) {
          try {
            await fetch('/api/friends', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_tg_id: tg_id,       // тот, кто перешёл по ссылке
                friend_tg_id: referrerId, // тот, кто пригласил
              }),
            })
          } catch (err) {
            console.error('[TelegramProvider] Friend invite failed:', err)
          }
        }
      }

      setLoading(false)
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{children}</>
}
