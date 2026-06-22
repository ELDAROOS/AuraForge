'use client'

import { useEffect, useRef, useState } from 'react'
import { WorkoutProgram, Exercise } from '@/lib/workouts-db'
import { useAppStore } from '@/store/useAppStore'
import { useTelegram } from '@/hooks/useTelegram'
import { X, Pause, Play, SkipForward, CheckCircle, Zap } from 'lucide-react'
import confetti from 'canvas-confetti'

// ─── Circular SVG Timer ───────────────────────────────────────────
const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface CircularTimerProps {
  total: number
  remaining: number
  isPaused: boolean
}

function CircularTimer({ total, remaining, isPaused }: CircularTimerProps) {
  const progress = remaining / total
  const dashOffset = CIRCUMFERENCE * (1 - progress)

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full -rotate-90"
          aria-hidden
        >
          {/* Track */}
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke="#27272a"
            strokeWidth="6"
          />
          {/* Progress arc */}
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke={isPaused ? '#52525b' : '#ffffff'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
          />
        </svg>
        {/* Center digits */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-black text-zinc-100 mono-number tabular-nums">
            {minutes > 0
              ? `${minutes}:${String(seconds).padStart(2, '0')}`
              : String(seconds).padStart(2, '0')}
          </span>
        </div>
      </div>
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
        секунд осталось
      </p>
    </div>
  )
}

// ─── Reps Display ─────────────────────────────────────────────────
interface RepsDisplayProps {
  count: number
  onDone: () => void
}

function RepsDisplay({ count, onDone }: RepsDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col items-center">
        <span className="text-[88px] font-black text-zinc-100 mono-number leading-none tabular-nums">
          {count}
        </span>
        <span className="text-sm font-bold text-zinc-500 uppercase tracking-widest -mt-1">
          повторений
        </span>
      </div>
      <button
        onClick={onDone}
        className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-zinc-100 text-black font-bold text-sm uppercase tracking-widest transition-all duration-200 active:scale-95 hover:bg-white"
      >
        <CheckCircle size={16} />
        Готово
      </button>
    </div>
  )
}

// ─── Completion Screen ────────────────────────────────────────────
interface CompletionScreenProps {
  workout: WorkoutProgram
  onClose: () => void
}

const getTodayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function CompletionScreen({ workout, onClose }: CompletionScreenProps) {
  const { dbUser, setDbUser } = useAppStore()
  const { haptic } = useTelegram()
  
  const [saving, setSaving] = useState(true)

  useEffect(() => {
    haptic.success()
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#ffffff', '#a1a1aa', '#3f3f46'],
      disableForReducedMotion: true,
    })

    const saveWorkout = async () => {
      if (!dbUser?.tg_id) {
        setSaving(false)
        return
      }

      // Save to local storage tracking
      const storageKey = `body_${dbUser.tg_id}_${getTodayKey()}`
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]')
      if (!saved.includes(workout.id)) {
        saved.push(workout.id)
        localStorage.setItem(storageKey, JSON.stringify(saved))
      }

      // Award XP to database
      try {
        const res = await fetch('/api/xp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            tg_id: dbUser.tg_id, 
            amount: workout.xpReward, 
            reason: `workout_completed_${workout.id}` 
          })
        })
        if (res.ok) {
          const { user } = await res.json()
          if (user) setDbUser(user)
        }
      } catch (e) {
        console.error('Failed to award XP', e)
      } finally {
        setSaving(false)
      }
    }

    saveWorkout()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        className="w-full max-w-sm rounded-3xl border border-zinc-700/50 bg-zinc-900/90 backdrop-blur-md p-8 flex flex-col items-center gap-5"
        style={{ animation: 'fadeSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
      >
        {/* Glow badge */}
        <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
          <Zap size={28} className="text-zinc-100" />
        </div>

        <div className="text-center">
          <p className="mono-heading mb-1">Программа завершена</p>
          <h2 className="text-2xl font-black text-zinc-100 uppercase tracking-tight">
            Aura Upgraded
          </h2>
        </div>

        {/* XP chip */}
        <div className="px-6 py-3 rounded-2xl bg-zinc-800 border border-zinc-700">
          <span className="text-3xl font-black text-zinc-100 mono-number">
            +{workout.xpReward}
          </span>
          <span className="text-sm font-bold text-zinc-400 ml-2 uppercase tracking-widest">
            XP
          </span>
        </div>

        <p className="text-xs text-zinc-500 text-center leading-relaxed">
          {saving ? 'Сохраняем прогресс...' : 'Очки начислены. Так держать!'}
        </p>

        <button
          onClick={onClose}
          disabled={saving}
          className={`w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-sm transition-all ${
            saving 
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
              : 'bg-zinc-100 text-black active:scale-95 hover:bg-white'
          }`}
        >
          {saving ? 'Сохранение...' : 'Закрыть'}
        </button>
      </div>
    </div>
  )
}

// ─── Progress Bar (exercise steps) ────────────────────────────────
interface StepBarProps {
  total: number
  current: number
}

function StepBar({ total, current }: StepBarProps) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            i < current
              ? 'bg-zinc-100'
              : i === current
              ? 'bg-zinc-500'
              : 'bg-zinc-800'
          }`}
        />
      ))}
    </div>
  )
}

// ─── Main Player ──────────────────────────────────────────────────
interface WorkoutPlayerProps {
  workout: WorkoutProgram
  onExit: () => void
}

export function WorkoutPlayer({ workout, onExit }: WorkoutPlayerProps) {
  const { haptic } = useTelegram()
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const exercise: Exercise = workout.exercises[exerciseIndex]
  const isTimeBased = exercise.type === 'time'
  const isLastExercise = exerciseIndex === workout.exercises.length - 1

  // Init / reset timer when exercise changes
  useEffect(() => {
    if (isTimeBased) {
      setTimeRemaining(exercise.count)
      setIsPaused(false)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [exerciseIndex, isTimeBased, exercise.count])

  // Countdown logic
  useEffect(() => {
    if (!isTimeBased) return
    if (intervalRef.current) clearInterval(intervalRef.current)

    if (!isPaused && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((t) => {
          if (t <= 1) {
            clearInterval(intervalRef.current!)
            haptic.medium() // Trigger haptic when timer ends
            handleNext()
            return 0
          }
          if (t <= 4) haptic.light() // Light haptics for last 3 seconds
          return t - 1
        })
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused, isTimeBased, exerciseIndex, haptic])

  function handleNext() {
    haptic.light()
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (isLastExercise) {
      setIsComplete(true)
    } else {
      setExerciseIndex((i) => i + 1)
    }
  }

  function handleTogglePause() {
    haptic.light()
    setIsPaused((p) => !p)
  }

  return (
    <div className="page-enter flex flex-col min-h-full bg-black pb-8">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 pt-6 pb-4">
        <button
          onClick={() => { haptic.light(); onExit() }}
          className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center transition-all active:scale-90"
          aria-label="Завершить тренировку"
        >
          <X size={16} className="text-zinc-400" />
        </button>
        <div className="text-center">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
            {workout.name}
          </p>
        </div>
        <div className="w-9 h-9" aria-hidden /> {/* spacer */}
      </div>

      {/* ── Step progress ── */}
      <div className="px-4 mb-6">
        <StepBar total={workout.exercises.length} current={exerciseIndex} />
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] font-bold text-zinc-600 mono-number uppercase tracking-wider">
            {exerciseIndex + 1} / {workout.exercises.length}
          </span>
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
            {isLastExercise ? 'ПОСЛЕДНЕЕ' : 'СЛЕДУЮЩЕЕ'}
          </span>
        </div>
      </div>

      {/* ── Exercise Card ── */}
      <div className="px-4 flex-1 flex flex-col">
        <div
          key={exerciseIndex}
          className="card-mono p-6 flex-1 flex flex-col"
          style={{ animation: 'fadeSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
        >
          {/* Exercise type badge */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[9px] font-bold px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 uppercase tracking-widest">
              {isTimeBased ? 'На время' : 'На повторения'}
            </span>
            {!isLastExercise && (
              <span className="text-[9px] text-zinc-600 uppercase tracking-widest">
                Далее: {workout.exercises[exerciseIndex + 1].name}
              </span>
            )}
          </div>

          {/* Exercise name */}
          <h2 className="text-2xl font-black text-zinc-100 uppercase tracking-tight leading-tight mb-2">
            {exercise.name}
          </h2>
          <p className="text-sm text-zinc-500 leading-relaxed mb-6">
            {exercise.description}
          </p>

          {/* Central visual: timer or reps */}
          <div className="flex-1 flex items-center justify-center">
            {isTimeBased ? (
              <CircularTimer
                total={exercise.count}
                remaining={timeRemaining}
                isPaused={isPaused}
              />
            ) : (
              <RepsDisplay count={exercise.count} onDone={handleNext} />
            )}
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="px-4 pt-4 flex gap-3">
        {/* Pause (only for timed exercises) */}
        {isTimeBased && (
          <button
            onClick={handleTogglePause}
            className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 transition-all active:scale-90 hover:border-zinc-600"
            aria-label={isPaused ? 'Продолжить' : 'Пауза'}
          >
            {isPaused ? (
              <Play size={18} className="text-zinc-300" />
            ) : (
              <Pause size={18} className="text-zinc-400" />
            )}
          </button>
        )}

        {/* Next / Finish */}
        <button
          onClick={handleNext}
          className="flex-1 h-14 rounded-2xl bg-zinc-100 text-black font-bold text-sm uppercase tracking-widest transition-all duration-200 active:scale-95 hover:bg-white flex items-center justify-center gap-2"
        >
          {isLastExercise ? (
            <>
              <CheckCircle size={16} />
              Завершить
            </>
          ) : (
            <>
              <SkipForward size={16} />
              Следующее
            </>
          )}
        </button>
      </div>

      {/* ── Completion overlay ── */}
      {isComplete && (
        <CompletionScreen workout={workout} onClose={onExit} />
      )}
    </div>
  )
}
