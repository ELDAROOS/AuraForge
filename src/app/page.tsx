'use client'

import Link from 'next/link'
import { Scan, Dumbbell, Utensils, Flame, ChevronRight, Zap } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { calculateAuraLevel, xpForNextLevel } from '@/lib/nutrition/tdee'
import { Skeleton } from '@/components/ui/skeleton'
import { DailyRoutine } from '@/components/aura/DailyRoutine'

// ─── Aura Widget ──────────────────────────────────────────────────
function AuraWidget() {
  const { dbUser, tgUser, isLoading } = useAppStore()

  if (isLoading) return <AuraWidgetSkeleton />

  const level = dbUser?.aura_level ?? 1
  const points = dbUser?.aura_points ?? 0
  const nextLevelXp = xpForNextLevel(level)
  const prevLevelXp = xpForNextLevel(level - 1)
  const progress = Math.min(100, Math.round(((points - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100))
  
  const firstName = tgUser?.first_name ?? dbUser?.first_name ?? 'Чемпион'

  return (
    <div className="px-4 pt-8 pb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-medium text-zinc-400 mb-0.5 tracking-wide">
            С возвращением,
          </p>
          <h1 className="text-2xl font-bold text-zinc-100">
            {firstName}
          </h1>
        </div>
        <div className="w-12 h-12 rounded-full overflow-hidden border border-zinc-700/50">
            {tgUser?.photo_url ? (
                <img src={tgUser.photo_url} alt="avatar" className="w-full h-full object-cover grayscale" />
            ) : (
                <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                    <Zap size={20} className="text-zinc-400" />
                </div>
            )}
        </div>
      </div>

      {/* Architectural Card */}
      <div className="card-mono p-5 relative overflow-hidden group">
        <div className="relative z-10 flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
                <Zap size={16} className="text-zinc-400" />
                <p className="mono-heading">Твоя Аура</p>
            </div>
            <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black text-zinc-100 mono-number tracking-tighter">LVL {level}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700/50 mb-1">
              <Flame size={14} className="text-zinc-400" />
              <span className="text-xs font-bold text-zinc-100 mono-number">{dbUser?.current_streak ?? 0} ДНЕЙ</span>
            </div>
            <p className="text-[11px] font-medium text-zinc-400 mt-1 mono-number uppercase">{points.toLocaleString()} XP</p>
          </div>
        </div>

        {/* Custom Progress Bar */}
        <div className="relative z-10">
            <div className="flex justify-between text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
                <span>Прогресс</span>
                <span className="mono-number">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden shadow-inner border border-zinc-700/50">
              <div
                  className="h-full bg-zinc-100 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-zinc-500 mt-2 font-medium">ОСТАЛОСЬ <span className="mono-number">{(nextLevelXp - points).toLocaleString()}</span> XP ДО {level + 1} УРОВНЯ</p>
        </div>
      </div>
    </div>
  )
}

function AuraWidgetSkeleton() {
  return (
    <div className="px-4 pt-8 pb-6">
      <Skeleton className="h-6 w-32 mb-1 bg-zinc-800" />
      <Skeleton className="h-8 w-48 mb-5 bg-zinc-800" />
      <Skeleton className="h-36 w-full rounded-[24px] bg-zinc-800" />
    </div>
  )
}

// ─── Module Cards ─────────────────────────────────────────────────
const MODULES = [
  {
    href:        '/face',
    label:       'ЛИЦО И КОЖА',
    description: 'Скан, уход, мьюинг',
    icon:        Scan,
    items:       ['СКАН', 'УХОД'],
  },
  {
    href:        '/body',
    label:       'ТЕЛО И ОСАНКА',
    description: 'Тренировки, осанка',
    icon:        Dumbbell,
    items:       ['УПРАЖНЕНИЯ', 'КОНТРОЛЬ'],
  },
  {
    href:        '/nutrition',
    label:       'NUTRICLEAN',
    description: 'КБЖУ, база продуктов',
    icon:        Utensils,
    items:       ['КБЖУ', 'ШТРИХКОД'],
  },
] as const

// ─── Page ─────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="page-enter min-h-full pb-8">
      <AuraWidget />
      
      {/* Рутина с чекбоксами и визуалом */}
      <DailyRoutine />

      {/* Module Cards */}
      <div className="px-4 mt-6">
        <h2 className="mono-heading mb-3">
          Модули
        </h2>
        <div className="flex flex-col gap-3">
          {MODULES.map(({ href, label, description, icon: Icon, items }) => (
            <Link key={href} href={href} className="block group">
              <div className="card-mono p-4 transition-all duration-200 group-active:scale-[0.98] hover:border-zinc-500/50">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                    <Icon size={20} className="text-zinc-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-zinc-100 tracking-wide text-sm">{label}</p>
                      <ChevronRight size={16} className="text-zinc-500 group-hover:text-zinc-100 transition-colors" />
                    </div>
                    <p className="text-xs text-zinc-400">{description}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {items.map((item) => (
                        <span
                          key={item}
                          className="text-[9px] font-bold px-2 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50 tracking-wider"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
