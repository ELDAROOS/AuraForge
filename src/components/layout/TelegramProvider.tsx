'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { TelegramUser } from '@/types/telegram'

/**
 * Инициализирует Telegram WebApp SDK, регистрирует пользователя в Supabase
 * и обрабатывает invite-параметр из deep link (startapp=invite_ID).
 * Если запущено вне Telegram, создаёт локальный веб-профиль для полноценной работы.
 */
export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const { setTgUser, setDbUser, setLoading } = useAppStore()
  const initialized = useRef(false)

  useEffect(() => {
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

      // ── 3. Определяем tg_id: Telegram, Web-fallback или Dev ──────
      let tg_id = tgUser?.id
      let isWebUser = false

      if (!tg_id) {
        // Если мы не в телеграме (обычный браузер)
        const storedWebId = localStorage.getItem('auraforge_web_id')
        if (storedWebId) {
          tg_id = parseInt(storedWebId, 10)
        } else {
          // Генерируем случайный ID для веб-пользователя (от 1 млрд до 2 млрд)
          tg_id = Math.floor(Math.random() * 1000000000) + 1000000000
          localStorage.setItem('auraforge_web_id', tg_id.toString())
        }
        isWebUser = true
      } else {
        if (tgUser) setTgUser(tgUser)
      }

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
                  tg_id: tg_id,
                  first_name: isWebUser ? 'Web' : 'Dev',
                  last_name: isWebUser ? 'User' : 'User',
                  tg_username: null, // Пустой юзернейм для веба
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

      // ── 5. Обработка invite-ссылки ──────────────────────────────
      const startParam = tg?.initDataUnsafe?.start_param

      if (startParam?.startsWith('invite_') && !isWebUser) {
        const referrerId = parseInt(startParam.replace('invite_', ''), 10)

        if (!isNaN(referrerId) && referrerId !== tg_id) {
          try {
            await fetch('/api/friends', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_tg_id: tg_id,
                friend_tg_id: referrerId,
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
