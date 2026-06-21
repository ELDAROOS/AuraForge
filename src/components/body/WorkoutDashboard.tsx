'use client'

import { workouts, WorkoutProgram } from '@/lib/workouts-db'
import { Dumbbell, Clock, Zap, ChevronRight, Activity } from 'lucide-react'

interface WorkoutDashboardProps {
  onSelect: (workout: WorkoutProgram) => void
}

const TAG_COLORS: Record<string, string> = {
  STRENGTH: 'text-zinc-100 bg-zinc-700 border-zinc-600',
  MOBILITY: 'text-zinc-300 bg-zinc-800 border-zinc-700',
}

export function WorkoutDashboard({ onSelect }: WorkoutDashboardProps) {
  return (
    <div className="page-enter px-4 pt-6 pb-8">
      {/* Header */}
      <div className="mb-6">
        <p className="mono-heading mb-1">Модуль</p>
        <h1 className="text-3xl font-black text-zinc-100 uppercase tracking-tight leading-none">
          Тело &amp; Осанка
        </h1>
        <p className="text-sm text-zinc-500 mt-2">
          Выбери программу и начни прямо сейчас
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card-mono p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={14} className="text-zinc-500" />
            <span className="mono-heading text-[10px]">Программ</span>
          </div>
          <p className="text-2xl font-black text-zinc-100 mono-number">
            {workouts.length}
          </p>
        </div>
        <div className="card-mono p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-zinc-500" />
            <span className="mono-heading text-[10px]">XP доступно</span>
          </div>
          <p className="text-2xl font-black text-zinc-100 mono-number">
            {workouts.reduce((s, w) => s + w.xpReward, 0)}
          </p>
        </div>
      </div>

      {/* Workout Cards */}
      <div className="space-y-3">
        {workouts.map((workout, idx) => (
          <button
            key={workout.id}
            onClick={() => onSelect(workout)}
            className="w-full text-left group"
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            <div className="card-mono p-5 transition-all duration-200 active:scale-[0.98] hover:border-zinc-600/60 relative overflow-hidden">
              {/* Subtle index number background */}
              <span
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[80px] font-black text-zinc-800/30 select-none pointer-events-none mono-number leading-none"
                aria-hidden
              >
                {String(idx + 1).padStart(2, '0')}
              </span>

              <div className="relative z-10">
                {/* Tag + XP */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[9px] font-bold px-2 py-1 rounded border tracking-widest ${TAG_COLORS[workout.tag] ?? TAG_COLORS.MOBILITY}`}
                  >
                    {workout.tag}
                  </span>
                  <div className="flex items-center gap-1">
                    <Zap size={11} className="text-zinc-500" />
                    <span className="text-[10px] font-bold text-zinc-400 mono-number">
                      +{workout.xpReward} XP
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h2 className="text-lg font-black text-zinc-100 uppercase tracking-tight leading-tight mb-1">
                  {workout.name}
                </h2>
                <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                  {workout.subtitle}
                </p>

                {/* Meta row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} className="text-zinc-600" />
                      <span className="text-xs font-semibold text-zinc-400 mono-number">
                        {workout.totalMinutes} МИН
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Dumbbell size={13} className="text-zinc-600" />
                      <span className="text-xs font-semibold text-zinc-400 mono-number">
                        {workout.exercises.length} УПР.
                      </span>
                    </div>
                  </div>
                  <ChevronRight
                    size={18}
                    className="text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all duration-200"
                  />
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
