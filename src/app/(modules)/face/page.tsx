'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Scan, Timer, Moon, Sun, Loader2, Check } from 'lucide-react'
import { useTelegram } from '@/hooks/useTelegram'

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

// ── Skincare routine data ─────────────────────────────────────
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

// ── Mewing exercises ─────────────────────────────────────────
const MEWING_EXERCISES = [
  { emoji: '🦷', label: 'Мьюинг', duration: '10 мин', xp: 15 },
  { emoji: '💪', label: 'Упражнения для шеи', duration: '5 мин', xp: 10 },
  { emoji: '😤', label: 'Жевание жвачки (mastic gum)', duration: '10 мин', xp: 10 },
  { emoji: '🙂', label: 'Chin tucks', duration: '3 мин', xp: 8 },
]

// ── Tabs ─────────────────────────────────────────────────────
type Tab = 'scanner' | 'skincare' | 'mewing'

const TABS: { id: Tab; label: string; icon: typeof Scan }[] = [
  { id: 'scanner',  label: 'Скан',       icon: Scan  },
  { id: 'skincare', label: 'Уход',       icon: Moon  },
  { id: 'mewing',   label: 'Упражнения', icon: Timer },
]

// ── Skincare Tab ─────────────────────────────────────────────
function SkincareTab() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const toggle = (key: string) =>
    setChecked(prev => ({ ...prev, [key]: !prev[key] }))

  const renderList = (items: typeof SKINCARE_MORNING, prefix: string) =>
    items.map(({ emoji, label }) => {
      const key = `${prefix}-${label}`
      const done = !!checked[key]
      return (
        <div
          key={key}
          onClick={() => toggle(key)}
          className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all duration-200 border ${
            done
              ? 'bg-zinc-800/40 border-zinc-700/50'
              : 'bg-zinc-900 border-zinc-800'
          }`}
        >
          <span className={`text-xl transition-all ${done ? 'opacity-40 grayscale' : ''}`}>{emoji}</span>
          <p className={`text-sm font-bold flex-1 transition-colors ${
            done ? 'text-zinc-500 line-through' : 'text-zinc-100'
          }`}>
            {label}
          </p>
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
            done ? 'bg-zinc-100 border-zinc-100 text-black' : 'border-zinc-700 bg-zinc-800/50'
          }`}>
            {done && <Check size={14} strokeWidth={4} />}
          </div>
        </div>
      )
    })

  return (
    <div className="px-4 space-y-6 pb-6 mt-4">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sun size={14} className="text-zinc-500" />
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Утренняя рутина</p>
        </div>
        <div className="space-y-2">{renderList(SKINCARE_MORNING, 'am')}</div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Moon size={14} className="text-zinc-500" />
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Вечерняя рутина</p>
        </div>
        <div className="space-y-2">{renderList(SKINCARE_EVENING, 'pm')}</div>
      </div>
    </div>
  )
}

// ── Mewing / Exercise Tab ─────────────────────────────────────
function MewingTab() {
  const { haptic } = useTelegram()
  const [activeTimer, setActiveTimer] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const startTimer = (label: string) => {
    haptic.medium()
    setActiveTimer(label)
    setElapsed(0)
    const interval = setInterval(() => setElapsed(e => e + 1), 1000)
    
    const stop = () => {
      clearInterval(interval)
      setActiveTimer(null)
      haptic.success()
    }
    setTimeout(stop, 600_000) // max 10 min
    
    ;(window as unknown as Record<string, unknown>).__stopTimer__ = stop
  }

  const stopTimer = () => {
    const stop = (window as unknown as Record<string, unknown>).__stopTimer__ as (() => void) | undefined
    stop?.()
  }

  const fmtTime = (s: number) => 
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="px-4 space-y-3 pb-6 mt-4">
      {activeTimer && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4 text-center">
          <p className="text-[10px] text-emerald-500 font-bold mb-2 uppercase tracking-widest animate-pulse">
            Таймер активен
          </p>
          <p className="text-5xl font-black text-zinc-100 mono-number tracking-tighter">
            {fmtTime(elapsed)}
          </p>
          <p className="text-xs font-bold text-zinc-500 mt-2 uppercase tracking-widest">{activeTimer}</p>
          <button 
            onClick={stopTimer} 
            className="mt-6 px-6 py-2.5 bg-red-500/10 text-red-500 font-bold text-[10px] uppercase tracking-widest border border-red-500/20 rounded-xl hover:bg-red-500/20 active:scale-95 transition-all"
          >
            Завершить
          </button>
        </div>
      )}
      
      {MEWING_EXERCISES.map(({ emoji, label, duration, xp }) => (
        <div key={label} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center gap-4">
          <span className="text-2xl flex-shrink-0">{emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-zinc-100 truncate">{label}</p>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1.5">
                <Timer size={10} className="text-zinc-600" />
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{duration}</p>
              </div>
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">+{xp} XP</p>
            </div>
          </div>
          <button
            onClick={() => activeTimer === label ? stopTimer() : startTimer(label)}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest flex-shrink-0 transition-all ${
              activeTimer === label
                ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                : 'bg-zinc-100 text-black active:scale-95 hover:bg-white'
            }`}
          >
            {activeTimer === label ? 'Стоп' : 'Старт'}
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function FacePage() {
  const [activeTab, setActiveTab] = useState<Tab>('scanner')
  const { haptic } = useTelegram()

  return (
    <div className="page-enter min-h-full">
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
