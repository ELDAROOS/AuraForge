'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useRef } from 'react'
import { Scan, Timer, Moon, Sun, Loader2, Check, Sparkles } from 'lucide-react'
import confetti from 'canvas-confetti'
import { useTelegram } from '@/hooks/useTelegram'
import { useAppStore } from '@/store/useAppStore'

// ── Dynamic import — MediaPipe is browser-only ──────────────────
const AdvancedFaceScanner = dynamic(
  () => import('@/components/face/AdvancedFaceScanner').then(m => ({ default: m.AdvancedFaceScanner })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center gap-4 py-20 px-4">
        <Loader2 size={32} className="animate-spin text-zinc-500" />
        <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
          Инициализация сканера...
        </p>
      </div>
    ),
  }
)

// ── Routine & Exercises Data ─────────────────────────────────────
const SKINCARE_MORNING = [
  { emoji: '🫧', label: 'Умывание пенкой' },
  { emoji: '💧', label: 'Тоник / мицеллярная вода' },
  { emoji: '🧴', label: 'Увлажняющий крем' },
  { emoji: '☀️', label: 'Санскрин SPF 50+' },
]

const SKINCARE_EVENING = [
  { emoji: '🫧', label: 'Двойное очищение' },
  { emoji: '🌿', label: 'Сыворотка (ниацинамид / ретинол)' },
  { emoji: '🧴', label: 'Ночной крем' },
  { emoji: '💋', label: 'Бальзам для губ' },
]

const MEWING_EXERCISES = [
  { emoji: '🦷', label: 'Мьюинг', durationSec: 10 * 60, xp: 15 },
  { emoji: '💪', label: 'Упражнения для шеи', durationSec: 5 * 60, xp: 10 },
  { emoji: '😤', label: 'Жевание жвачки', durationSec: 10 * 60, xp: 10 },
  { emoji: '🙂', label: 'Chin tucks', durationSec: 3 * 60, xp: 8 },
]

type Tab = 'scanner' | 'skincare' | 'mewing'
const TABS: { id: Tab; label: string; icon: typeof Scan }[] = [
  { id: 'scanner',  label: 'Скан',       icon: Scan  },
  { id: 'skincare', label: 'Уход',       icon: Moon  },
  { id: 'mewing',   label: 'Упражнения', icon: Timer },
]

// ── Helpers ──────────────────────────────────────────────────
const getTodayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function triggerConfetti() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#10b981', '#34d399', '#ffffff', '#a1a1aa'],
    disableForReducedMotion: true,
  })
}

// ── Skincare Tab ─────────────────────────────────────────────
function SkincareTab() {
  const { dbUser, setDbUser } = useAppStore()
  const { haptic } = useTelegram()
  
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [completedRoutines, setCompletedRoutines] = useState<Record<string, boolean>>({})

  const storageKey = `skincare_${dbUser?.tg_id}_${getTodayKey()}`

  // Load state
  useEffect(() => {
    if (!dbUser?.tg_id) return
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed = JSON.parse(saved)
      setChecked(parsed.checked || {})
      setCompletedRoutines(parsed.completedRoutines || {})
    }
  }, [dbUser?.tg_id, storageKey])

  // Save state
  const saveState = (newChecked: Record<string, boolean>, newCompleted: Record<string, boolean>) => {
    localStorage.setItem(storageKey, JSON.stringify({ checked: newChecked, completedRoutines: newCompleted }))
  }

  // Award XP
  const awardXp = async (amount: number, reason: string) => {
    if (!dbUser?.tg_id) return
    try {
      const res = await fetch('/api/xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tg_id: dbUser.tg_id, amount, reason })
      })
      if (res.ok) {
        const { user } = await res.json()
        if (user) setDbUser(user)
      }
    } catch (e) {
      console.error('Failed to award XP', e)
    }
  }

  const toggle = (key: string, listType: 'am' | 'pm') => {
    haptic.light()
    
    const newChecked = { ...checked, [key]: !checked[key] }
    setChecked(newChecked)

    // Check if routine just completed
    const list = listType === 'am' ? SKINCARE_MORNING : SKINCARE_EVENING
    const allDone = list.every(item => newChecked[`${listType}-${item.label}`])
    
    let newCompleted = { ...completedRoutines }
    if (allDone && !completedRoutines[listType]) {
      haptic.success()
      triggerConfetti()
      newCompleted[listType] = true
      setCompletedRoutines(newCompleted)
      awardXp(15, `skincare_routine_${listType}`) // +15 XP for full routine
    } else if (!allDone && completedRoutines[listType]) {
      // Reverted
      newCompleted[listType] = false
      setCompletedRoutines(newCompleted)
    }

    saveState(newChecked, newCompleted)
  }

  const renderList = (items: typeof SKINCARE_MORNING, prefix: 'am' | 'pm') => {
    const isRoutineDone = completedRoutines[prefix]

    return (
      <div className={`space-y-2 rounded-3xl p-2 transition-all ${
        isRoutineDone ? 'bg-emerald-500/5 border border-emerald-500/20' : ''
      }`}>
        {items.map(({ emoji, label }) => {
          const key = `${prefix}-${label}`
          const done = !!checked[key]
          return (
            <div
              key={key}
              onClick={() => toggle(key, prefix)}
              className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all duration-300 border ${
                done
                  ? 'bg-zinc-800/40 border-zinc-700/50'
                  : 'bg-zinc-900 border-zinc-800 shadow-sm'
              }`}
            >
              <span className={`text-xl transition-all duration-500 ${done ? 'opacity-40 grayscale scale-90' : 'scale-100'}`}>
                {emoji}
              </span>
              <p className={`text-sm font-bold flex-1 transition-colors duration-300 ${
                done ? 'text-zinc-500 line-through' : 'text-zinc-100'
              }`}>
                {label}
              </p>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                done 
                  ? isRoutineDone ? 'bg-emerald-500 border-emerald-500 text-black' : 'bg-zinc-100 border-zinc-100 text-black' 
                  : 'border-zinc-700 bg-zinc-800/50'
              }`}>
                {done && <Check size={14} strokeWidth={4} />}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="px-2 space-y-6 pb-6 mt-4">
      <div>
        <div className="flex items-center justify-between px-2 mb-3">
          <div className="flex items-center gap-2">
            <Sun size={14} className="text-zinc-500" />
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Утренняя рутина</p>
          </div>
          {completedRoutines['am'] && (
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1">
              <Sparkles size={10} /> Завершено (+15 XP)
            </span>
          )}
        </div>
        {renderList(SKINCARE_MORNING, 'am')}
      </div>

      <div>
        <div className="flex items-center justify-between px-2 mb-3">
          <div className="flex items-center gap-2">
            <Moon size={14} className="text-zinc-500" />
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Вечерняя рутина</p>
          </div>
          {completedRoutines['pm'] && (
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded flex items-center gap-1">
              <Sparkles size={10} /> Завершено (+15 XP)
            </span>
          )}
        </div>
        {renderList(SKINCARE_EVENING, 'pm')}
      </div>
    </div>
  )
}

// ── Mewing / Exercise Tab ─────────────────────────────────────
function MewingTab() {
  const { haptic } = useTelegram()
  const { dbUser, setDbUser } = useAppStore()

  const [activeExercise, setActiveExercise] = useState<typeof MEWING_EXERCISES[0] | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  
  // Track completed exercises today
  const [completedToday, setCompletedToday] = useState<Set<string>>(new Set())
  const storageKey = `mewing_${dbUser?.tg_id}_${getTodayKey()}`

  // Load completions
  useEffect(() => {
    if (!dbUser?.tg_id) return
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      setCompletedToday(new Set(JSON.parse(saved)))
    }
  }, [dbUser?.tg_id, storageKey])

  const saveCompletion = (label: string) => {
    const newSet = new Set(completedToday).add(label)
    setCompletedToday(newSet)
    localStorage.setItem(storageKey, JSON.stringify(Array.from(newSet)))
  }

  const awardXp = async (amount: number, reason: string) => {
    if (!dbUser?.tg_id) return
    try {
      const res = await fetch('/api/xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tg_id: dbUser.tg_id, amount, reason })
      })
      if (res.ok) {
        const { user } = await res.json()
        if (user) setDbUser(user)
      }
    } catch (e) {
      console.error('Failed to award XP', e)
    }
  }

  // Timer logic
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const clearCurrentTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }

  const startTimer = (exercise: typeof MEWING_EXERCISES[0]) => {
    haptic.medium()
    clearCurrentTimer()
    
    setActiveExercise(exercise)
    setTimeLeft(exercise.durationSec)

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Finished!
          clearCurrentTimer()
          handleFinish(exercise)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleFinish = (exercise: typeof MEWING_EXERCISES[0]) => {
    haptic.success()
    triggerConfetti()
    saveCompletion(exercise.label)
    awardXp(exercise.xp, `exercise_completed_${exercise.label}`)
    setActiveExercise(null)
  }

  const stopTimer = () => {
    haptic.light()
    clearCurrentTimer()
    setActiveExercise(null)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => clearCurrentTimer()
  }, [])

  const fmtTime = (s: number) => 
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="px-4 space-y-4 pb-6 mt-4">
      
      {/* Active Timer Dashboard */}
      {activeExercise && (
        <div className="bg-zinc-900 border border-emerald-500/30 rounded-3xl p-8 mb-6 text-center shadow-[0_0_40px_rgba(16,185,129,0.05)] animate-in zoom-in-95 duration-300">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">
              Фокус
            </p>
          </div>
          
          <div className="relative">
            <p className="text-6xl font-black text-zinc-100 mono-number tracking-tighter tabular-nums">
              {fmtTime(timeLeft)}
            </p>
            {/* Simple progress ring via conic-gradient could go here, but omitted for simplicity */}
          </div>

          <p className="text-sm font-bold text-zinc-400 mt-4 uppercase tracking-widest">{activeExercise.label}</p>
          
          <button 
            onClick={stopTimer} 
            className="mt-8 px-8 py-3 bg-red-500/10 text-red-500 font-bold text-[10px] uppercase tracking-widest border border-red-500/20 rounded-xl hover:bg-red-500/20 active:scale-95 transition-all"
          >
            Сдаться
          </button>
        </div>
      )}
      
      {/* Exercise List */}
      <div className={`space-y-3 transition-all duration-500 ${activeExercise ? 'opacity-30 pointer-events-none blur-[2px]' : 'opacity-100'}`}>
        {MEWING_EXERCISES.map((ex) => {
          const isCompleted = completedToday.has(ex.label)
          
          return (
            <div key={ex.label} className={`bg-zinc-900 border p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 ${
              isCompleted ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-zinc-800'
            }`}>
              <span className={`text-3xl flex-shrink-0 transition-transform ${isCompleted ? 'scale-90 grayscale opacity-60' : ''}`}>
                {ex.emoji}
              </span>
              
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate transition-colors ${isCompleted ? 'text-zinc-400' : 'text-zinc-100'}`}>
                  {ex.label}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex items-center gap-1.5">
                    <Timer size={10} className="text-zinc-600" />
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      {Math.round(ex.durationSec / 60)} мин
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Sparkles size={10} className={isCompleted ? 'text-emerald-500/50' : 'text-emerald-500'} />
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${
                      isCompleted ? 'text-emerald-500/50' : 'text-emerald-500'
                    }`}>
                      {ex.xp} XP
                    </p>
                  </div>
                </div>
              </div>

              {isCompleted ? (
                <div className="px-3 py-2 flex items-center gap-1 text-emerald-500 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <Check size={14} strokeWidth={3} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Готово</span>
                </div>
              ) : (
                <button
                  onClick={() => startTimer(ex)}
                  className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex-shrink-0 transition-all bg-zinc-100 text-black active:scale-95 hover:bg-white"
                >
                  Старт
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function FacePage() {
  const [activeTab, setActiveTab] = useState<Tab>('scanner')
  const { haptic } = useTelegram()

  return (
    <div className="page-enter min-h-full pb-20">
      {/* Header */}
      <div className="px-4 pt-8 pb-5">
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">МОДУЛЬ</p>
        <h1 className="text-2xl font-black text-zinc-100">
          БИО<span className="text-zinc-500">МЕТРИЯ</span>
        </h1>
      </div>

      {/* Tab Bar */}
      <div className="px-4 mb-2">
        <div className="flex gap-2 p-1.5 bg-zinc-900 rounded-2xl border border-zinc-800">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { haptic.light(); setActiveTab(id) }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${
                activeTab === id
                  ? 'bg-zinc-100 text-black shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon size={14} strokeWidth={activeTab === id ? 2.5 : 2} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'scanner'  && <AdvancedFaceScanner />}
      {activeTab === 'skincare' && <SkincareTab />}
      {activeTab === 'mewing'   && <MewingTab />}
    </div>
  )
}
