'use client'

import { useState, useEffect } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { useTelegram } from '@/hooks/useTelegram'
import { useAppStore } from '@/store/useAppStore'
import { DbHabit, DbHabitLog } from '@/types/database'

type HabitWithLog = DbHabit & { habit_logs?: DbHabitLog[] | null }

export function DailyRoutine() {
  const { tgUser, haptic } = useTelegram()
  const { dbUser, updateAuraPoints } = useAppStore()
  const [habits, setHabits] = useState<HabitWithLog[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ id: number; text: string; x: number; y: number }[]>([])

  // Загружаем привычки пользователя
  useEffect(() => {
    const fetchHabits = async () => {
      if (!tgUser) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`/api/habits?tg_id=${tgUser.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.habits && data.habits.length > 0) {
            setHabits(data.habits)
            setLoading(false)
            return
          }
        }
      } catch (e) {
        console.error('Failed to fetch habits', e)
      }
      setLoading(false)
    }
    
    fetchHabits()
  }, [tgUser])

  // Фолбэк для демонстрации UI (если API пуст/недоступен)
  useEffect(() => {
    if (!loading && habits.length === 0) {
      setHabits([
        { id: '1', title: 'ВЫПИТЬ ВОДУ (2Л)', xp_reward: 10, icon_emoji: '💧', is_active: true } as HabitWithLog,
        { id: '2', title: 'УХОД ЗА КОЖЕЙ', xp_reward: 15, icon_emoji: '🧼', is_active: true } as HabitWithLog,
        { id: '3', title: 'ОСАНКА (5 МИН)', xp_reward: 20, icon_emoji: '🧘', is_active: true } as HabitWithLog,
      ])
    }
  }, [loading, habits.length])

  const handleToggle = async (habit: HabitWithLog, e: React.MouseEvent) => {
    const isDone = habit.habit_logs && habit.habit_logs.length > 0 && habit.habit_logs[0].status === 'completed'
    if (isDone) return // Уже выполнено

    // 1. Визуальные эффекты: Haptic Feedback + Всплывающий текст
    haptic.success()
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    // Рандомный сдвиг для динамики
    const offsetX = Math.random() * 20 - 10
    const newToast = { id: Date.now(), text: `+${habit.xp_reward} XP`, x: rect.right - 60 + offsetX, y: rect.top }
    
    setToast(prev => [...prev, newToast])
    setTimeout(() => {
      setToast(prev => prev.filter(t => t.id !== newToast.id))
    }, 1200)

    // 2. Оптимистичное обновление UI
    setHabits(prev => prev.map(h =>
      h.id === habit.id
        ? { ...h, habit_logs: [{ status: 'completed' as const, xp_earned: habit.xp_reward, id: 'temp', habit_id: habit.id, user_id: 'temp', log_date: '', created_at: '', note: null, duration_sec: null }] }
        : h
    ))

    // 3. Обновляем глобальный стейт Ауры (очки + уровень)
    if (dbUser) {
        const newPoints = dbUser.aura_points + habit.xp_reward
        const newLevel = Math.floor(Math.log2(newPoints / 50 + 1)) + 1 
        updateAuraPoints(newPoints, newLevel)
    }

    // 4. Фоновый запрос к Supabase
    // Пропускаем мок-привычки (у них id не UUID, а '1','2','3')
    const isRealHabit = tgUser && /^[0-9a-f-]{36}$/.test(habit.id)
    if (isRealHabit) {
      try {
        const resp = await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tg_id: tgUser.id,
            habit_id: habit.id,
            status: 'completed'
          })
        })
        if (resp.ok) {
          // Обновляем XP из ответа сервера (авторитетный источник)
          const { aura } = await resp.json()
          if (aura) updateAuraPoints(aura.points, aura.level)
        }
      } catch (error) {
        console.error('Failed to log habit in Supabase', error)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-6">
        <Loader2 className="animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="px-4 mb-6 relative">
      <h2 className="mono-heading mb-3">
        Дневная рутина
      </h2>

      {/* Всплывающие очки (Toasts) */}
      {toast.map(t => (
        <div 
          key={t.id} 
          className="xp-toast bg-zinc-100 text-black px-2 py-1 rounded-md font-mono text-xs font-bold tracking-tight shadow-md border border-zinc-300" 
          style={{ left: t.x, top: t.y, position: 'fixed', pointerEvents: 'none' }}
        >
          {t.text}
        </div>
      ))}

      <div className="space-y-2">
        {habits.map((habit) => {
          const isDone = habit.habit_logs && habit.habit_logs.length > 0 && habit.habit_logs[0].status === 'completed'
          
          return (
            <div 
              key={habit.id}
              onClick={(e) => handleToggle(habit, e)}
              className={`flex items-center justify-between p-4 rounded-2xl transition-all duration-300 border backdrop-blur-md cursor-pointer ${
                isDone 
                  ? 'bg-zinc-900 border-zinc-800 opacity-60 scale-[0.98]' 
                  : 'bg-zinc-900 border-zinc-700/50 hover:bg-zinc-800 active:scale-[0.98]'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`text-xl transition-transform duration-300 ${isDone ? 'scale-90 grayscale' : 'scale-100'}`}>
                  {habit.icon_emoji}
                </div>
                <div>
                  <p className={`font-bold text-sm tracking-wide transition-colors duration-300 ${isDone ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>
                    {habit.title}
                  </p>
                  <p className="text-[10px] mono-number font-bold text-zinc-400 uppercase mt-1">
                    +{habit.xp_reward} XP
                  </p>
                </div>
              </div>

              {/* HIG Status Checkbox (Emerald colored when done) */}
              <div className={`habit-check ${isDone ? 'habit-check--done' : 'bg-black shadow-inner'}`}>
                {isDone && <Check size={14} strokeWidth={4} className="text-black" />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
