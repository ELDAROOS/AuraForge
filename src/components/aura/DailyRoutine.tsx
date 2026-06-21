'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { useTelegram } from '@/hooks/useTelegram'
import { useAppStore } from '@/store/useAppStore'
import { DbHabit, DbHabitLog } from '@/types/database'
import { calculateAuraLevel } from '@/lib/nutrition/tdee'

type HabitWithLog = DbHabit & { habit_logs?: Pick<DbHabitLog, 'status' | 'xp_earned'>[] | null }

// Фиксированные fallback-привычки (показываются пока нет реального tg_id)
const FALLBACK_HABITS: HabitWithLog[] = [
  { id: '__1', title: 'ВЫПИТЬ ВОДУ (2Л)', xp_reward: 10, icon_emoji: '💧', is_active: true } as HabitWithLog,
  { id: '__2', title: 'УХОД ЗА КОЖЕЙ', xp_reward: 15, icon_emoji: '🧼', is_active: true } as HabitWithLog,
  { id: '__3', title: 'ОСАНКА (5 МИН)', xp_reward: 20, icon_emoji: '🧘', is_active: true } as HabitWithLog,
]

export function DailyRoutine() {
  const { tgUser, haptic } = useTelegram()
  const { dbUser, updateAuraPoints } = useAppStore()

  const [habits, setHabits] = useState<HabitWithLog[]>([])
  const [loading, setLoading] = useState(true)
  // Хранит id привычек, по которым уже летит запрос (предотвращает двойной тап)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [toasts, setToasts] = useState<{ id: number; text: string; x: number; y: number }[]>([])

  // ── Загрузка привычек ─────────────────────────────────────────────
  const fetchHabits = useCallback(async () => {
    if (!tgUser) {
      setHabits(FALLBACK_HABITS)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/habits?tg_id=${tgUser.id}`)
      if (res.ok) {
        const { habits: data } = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setHabits(data)
          setLoading(false)
          return
        }
      }
    } catch (err) {
      console.error('[DailyRoutine] fetch habits failed:', err)
    }
    // Fallback если API пустой или упал
    setHabits(FALLBACK_HABITS)
    setLoading(false)
  }, [tgUser])

  useEffect(() => { fetchHabits() }, [fetchHabits])

  // ── Обработка тапа по привычке ────────────────────────────────────
  const handleToggle = async (habit: HabitWithLog, e: React.MouseEvent) => {
    const isDone = habit.habit_logs?.[0]?.status === 'completed'
    if (isDone || pendingIds.has(habit.id)) return

    // ── Haptic + XP toast ─────────────────────────────────────────
    haptic.success()

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const toastId = Date.now()
    setToasts(prev => [...prev, {
      id: toastId,
      text: `+${habit.xp_reward} XP`,
      x: rect.right - 56 + (Math.random() * 16 - 8),
      y: rect.top - 8,
    }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 1300)

    // ── Optimistic UI: мгновенно помечаем как выполнено ──────────
    setHabits(prev => prev.map(h =>
      h.id === habit.id
        ? {
            ...h,
            habit_logs: [{ status: 'completed' as const, xp_earned: habit.xp_reward }],
          }
        : h
    ))

    // ── Optimistic XP: обновляем счётчик в шапке сразу ───────────
    if (dbUser) {
      const optimisticPoints = (dbUser.aura_points ?? 0) + habit.xp_reward
      updateAuraPoints(optimisticPoints, calculateAuraLevel(optimisticPoints))
    }

    // ── Флаг «в процессе» ────────────────────────────────────────
    setPendingIds(prev => new Set(prev).add(habit.id))

    // ── Фоновый запрос к Supabase ─────────────────────────────────
    // Пропускаем fallback-привычки (id начинается с '__')
    const isReal = tgUser && !habit.id.startsWith('__')
    if (isReal) {
      try {
        const resp = await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tg_id: tgUser.id,
            habit_id: habit.id,
            status: 'completed',
          }),
        })

        if (resp.ok) {
          const { aura } = await resp.json()
          // Синхронизируем с авторитетным значением от сервера
          if (aura) updateAuraPoints(aura.points, aura.level)
        } else {
          // Запрос упал — откатываем визуальный статус
          setHabits(prev => prev.map(h =>
            h.id === habit.id ? { ...h, habit_logs: [] } : h
          ))
          // Откатываем XP
          if (dbUser) {
            updateAuraPoints(dbUser.aura_points, dbUser.aura_level)
          }
          console.error('[DailyRoutine] Log failed:', await resp.text())
        }
      } catch (err) {
        console.error('[DailyRoutine] Network error:', err)
      }
    }

    setPendingIds(prev => {
      const next = new Set(prev)
      next.delete(habit.id)
      return next
    })
  }

  // ── Render ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="px-4 mb-6 flex justify-center py-8">
        <Loader2 size={24} className="animate-spin text-zinc-600" />
      </div>
    )
  }

  return (
    <div className="px-4 mb-6 relative">
      <h2 className="mono-heading mb-3">Дневная рутина</h2>

      {/* XP Toasts */}
      {toasts.map(t => (
        <div
          key={t.id}
          className="fixed pointer-events-none z-50 bg-zinc-100 text-black px-2 py-1 rounded-lg font-mono text-xs font-black tracking-tight border border-zinc-300 animate-bounce"
          style={{ left: t.x, top: t.y }}
          aria-hidden
        >
          {t.text}
        </div>
      ))}

      <div className="space-y-2">
        {habits.map((habit) => {
          const isDone = habit.habit_logs?.[0]?.status === 'completed'
          const isPending = pendingIds.has(habit.id)

          return (
            <button
              key={habit.id}
              type="button"
              onClick={(e) => handleToggle(habit, e)}
              disabled={isDone || isPending}
              className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 border cursor-pointer text-left ${
                isDone
                  ? 'bg-zinc-900 border-zinc-800 opacity-50 scale-[0.98]'
                  : 'bg-zinc-900 border-zinc-700/60 hover:bg-zinc-800/80 active:scale-[0.97]'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className={`text-xl transition-transform duration-300 ${isDone ? 'grayscale opacity-60' : ''}`}>
                  {habit.icon_emoji}
                </span>
                <div>
                  <p className={`font-bold text-sm tracking-wide transition-colors ${isDone ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>
                    {habit.title}
                  </p>
                  <p className="text-[10px] mono-number font-bold text-zinc-500 uppercase mt-0.5">
                    +{habit.xp_reward} XP
                  </p>
                </div>
              </div>

              <div className={`habit-check flex-shrink-0 ${isDone ? 'habit-check--done' : ''} ${isPending ? 'opacity-50 animate-pulse' : ''}`}>
                {isDone && <Check size={13} strokeWidth={3} className="text-black" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
