'use client'

import { useEffect, useRef } from 'react'

export function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // @ts-ignore
    window.onTelegramAuth = (user: any) => {
      onLogin(user)
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', 'auraforgemaxbot')
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(script)
    }
  }, [onLogin])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black px-6 pb-20">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black text-zinc-100 uppercase tracking-tight mb-4">AuraForge</h1>
        <p className="text-sm text-zinc-500 font-medium leading-relaxed">
          Войди через Telegram для синхронизации<br/>твоего профиля и базы данных.
        </p>
      </div>
      <div ref={containerRef} className="flex justify-center items-center min-h-[50px] transition-opacity" />
    </div>
  )
}
