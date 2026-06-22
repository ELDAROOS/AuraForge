'use client'

import { useEffect, useState, useRef } from 'react'

export function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [token, setToken] = useState<string>('')

  useEffect(() => {
    // Generate a unique token for this session
    const randomToken = Math.random().toString(36).substring(2, 15)
    setToken(randomToken)

    // Poll the server to check if the bot received this token
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/status?token=${randomToken}`)
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'success' && data.user) {
            clearInterval(interval)
            onLogin(data.user)
          }
        }
      } catch (e) {
        console.error('Polling error', e)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [onLogin])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black px-6 pb-20">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black text-zinc-100 uppercase tracking-tight mb-4">AuraForge</h1>
        <p className="text-sm text-zinc-500 font-medium leading-relaxed mb-8">
          Авторизация без паролей через твоего бота.<br/>Нажми на кнопку ниже.
        </p>

        {token ? (
          <a
            href={`https://t.me/auraforgemaxbot?start=login_${token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center bg-[#2AABEE] hover:bg-[#229ED9] text-white font-bold py-4 px-8 rounded-2xl transition-colors active:scale-95 shadow-lg shadow-[#2AABEE]/20"
          >
            Войти через Telegram-бота
          </a>
        ) : (
          <div className="w-full h-14 bg-zinc-900 rounded-2xl animate-pulse" />
        )}
        
        <p className="text-[10px] text-zinc-600 mt-6 font-medium uppercase tracking-widest">
          Страница обновится автоматически
        </p>
      </div>
    </div>
  )
}
