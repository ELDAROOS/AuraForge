'use client'

import { useEffect, useState } from 'react'
import { workouts, WorkoutProgram } from '@/lib/workouts-db'
import { useAppStore } from '@/store/useAppStore'
import { useTelegram } from '@/hooks/useTelegram'
import { Dumbbell, Clock, Zap, ChevronRight, Activity, CheckCircle2 } from 'lucide-react'

interface WorkoutDashboardProps {
  onSelect: (workout: WorkoutProgram) => void
}

const TAG_COLORS: Record<string, string> = {
  STRENGTH: 'text-zinc-100 bg-zinc-700 border-zinc-600',
  MOBILITY: 'text-zinc-300 bg-zinc-800 border-zinc-700',
}

const getTodayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function WorkoutDashboard({ onSelect }: WorkoutDashboardProps) {
  const { dbUser } = useAppStore()
  const { haptic } = useTelegram()
  const [completedWorkouts, setCompletedWorkouts] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!dbUser?.tg_id) return
    const storageKey = `body_${dbUser.tg_id}_${getTodayKey()}`
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      setCompletedWorkouts(new Set(JSON.parse(saved)))
    }
  }, [dbUser?.tg_id])

  return (
    <div className="page-enter px-4 pt-8 pb-20 min-h-full">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">МОДУЛЬ</p>
        <h1 className="text-2xl font-black text-zinc-100">
          ТЕЛО <span className="text-zinc-500">&amp;</span> ОСАНКА
        </h1>
        <p className="text-xs text-zinc-500 mt-2 font-medium">
          Выбери программу и начни прямо сейчас
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Activity size={12} className="text-zinc-500" />
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Программ</span>
          </div>
          <p className="text-2xl font-black text-zinc-100 mono-number tabular-nums">
            {workouts.length}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap size={12} className="text-emerald-500" />
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">XP за сегодня</span>
          </div>
          <p className="text-2xl font-black text-emerald-500 mono-number tabular-nums">
            {workouts.reduce((s, w) => s + (completedWorkouts.has(w.id) ? w.xpReward : 0), 0)}
            <span className="text-xs font-bold text-emerald-500/50 ml-1">
              / {workouts.reduce((s, w) => s + w.xpReward, 0)}
            </span>
          </p>
        </div>
      </div>

      {/* Workout Cards */}
      <div className="space-y-3">
        {workouts.map((workout, idx) => {
          const isCompleted = completedWorkouts.has(workout.id)

          return (
            <button
              key={workout.id}
              onClick={() => { haptic.light(); onSelect(workout) }}
              className="w-full text-left group"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <div className={`p-5 rounded-2xl border transition-all duration-300 active:scale-[0.98] relative overflow-hidden ${
                isCompleted 
                  ? 'bg-emerald-500/5 border-emerald-500/20' 
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}>
                {/* Subtle index number background */}
                <span
                  className={`absolute right-4 top-1/2 -translate-y-1/2 text-[80px] font-black select-none pointer-events-none mono-number leading-none transition-colors ${
                    isCompleted ? 'text-emerald-500/5' : 'text-zinc-800/30'
                  }`}
                  aria-hidden
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>

                <div className="relative z-10">
                  {/* Tag + XP */}
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`text-[9px] font-bold px-2 py-1 rounded border tracking-widest ${
                        isCompleted ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : (TAG_COLORS[workout.tag] ?? TAG_COLORS.MOBILITY)
                      }`}
                    >
                      {workout.tag}
                    </span>
                    
                    {isCompleted ? (
                      <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                        <CheckCircle2 size={12} strokeWidth={2.5} />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          Готово
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-zinc-800/50 px-2 py-1 rounded-md border border-zinc-700/50">
                        <Zap size={11} className="text-zinc-400" />
                        <span className="text-[10px] font-bold text-zinc-300 mono-number uppercase tracking-widest">
                          +{workout.xpReward} XP
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <h2 className={`text-xl font-black uppercase tracking-tight leading-tight mb-2 transition-colors ${
                    isCompleted ? 'text-emerald-50' : 'text-zinc-100'
                  }`}>
                    {workout.name}
                  </h2>
                  <p className={`text-xs mb-5 leading-relaxed max-w-[85%] transition-colors ${
                    isCompleted ? 'text-emerald-500/70' : 'text-zinc-500'
                  }`}>
                    {workout.subtitle}
                  </p>

                  {/* Meta row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className={isCompleted ? 'text-emerald-500/60' : 'text-zinc-600'} />
                        <span className={`text-[10px] font-bold mono-number uppercase tracking-widest ${
                          isCompleted ? 'text-emerald-500/80' : 'text-zinc-400'
                        }`}>
                          {workout.totalMinutes} МИН
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Dumbbell size={13} className={isCompleted ? 'text-emerald-500/60' : 'text-zinc-600'} />
                        <span className={`text-[10px] font-bold mono-number uppercase tracking-widest ${
                          isCompleted ? 'text-emerald-500/80' : 'text-zinc-400'
                        }`}>
                          {workout.exercises.length} УПР.
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      size={18}
                      className={`${isCompleted ? 'text-emerald-500/50' : 'text-zinc-600'} group-hover:translate-x-1 transition-all duration-300`}
                    />
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
