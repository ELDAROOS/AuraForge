'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, Dumbbell, Utensils, User, Scan } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTelegram } from '@/hooks/useTelegram'

const NAV_ITEMS = [
  { href: '/',           label: 'Аура',    icon: Sparkles  },
  { href: '/face',       label: 'Лицо',    icon: Scan      },
  { href: '/body',       label: 'Тело',    icon: Dumbbell  },
  { href: '/nutrition',  label: 'Питание', icon: Utensils  },
  { href: '/aura',       label: 'Профиль', icon: User      },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const { haptic } = useTelegram()

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] bg-black/80 backdrop-blur-xl border-t border-zinc-800"
      aria-label="Главная навигация"
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)

        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center justify-center flex-1 py-1 gap-1"
            onClick={() => haptic.light()}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon
              size={24}
              strokeWidth={isActive ? 2.5 : 1.8}
              className={`transition-all duration-300 ${isActive ? 'text-zinc-100 scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'text-zinc-500 hover:text-zinc-400'}`}
            />
            <span className={`text-[10px] font-bold tracking-widest uppercase transition-colors duration-300 ${isActive ? 'text-zinc-100' : 'text-zinc-500'}`}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
