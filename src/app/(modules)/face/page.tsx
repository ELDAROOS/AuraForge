'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Scan, Timer, Moon, Sun, ChevronRight, Loader2 } from 'lucide-react'
import { useTelegram } from '@/hooks/useTelegram'

// ── Dynamic import — MediaPipe is browser-only, never SSR ──────
const FaceScanner = dynamic(
  () => import('@/components/face/FaceScanner').then(m => ({ default: m.FaceScanner })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 size={28} className="animate-spin text-[rgb(var(--color-aura-purple))]" />
        <p className="text-sm text-[rgb(var(--text-muted))]">Загружаем Face Scanner…</p>
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
  { id: 'scanner',  label: 'Скан',    icon: Scan  },
  { id: 'skincare', label: 'Уход',    icon: Moon  },
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
          className={`flex items-center gap-3 p-3.5 rounded-2xl cursor-pointer transition-all duration-200 border ${
            done
              ? 'bg-[rgba(var(--color-aura-purple),0.06)] border-[rgba(var(--color-aura-purple),0.2)]'
              : 'bg-[rgb(var(--bg-card))] border-[rgba(var(--border-subtle),0.6)]'
          }`}
        >
          <span className={`text-xl transition-all ${done ? 'opacity-40' : ''}`}>{emoji}</span>
          <p className={`text-sm font-medium flex-1 transition-colors ${
            done ? 'text-[rgb(var(--text-muted))] line-through' : 'text-[rgb(var(--text-primary))]'
          }`}>{label}</p>
          <div className={`habit-check flex-shrink-0 ${done ? 'habit-check--done' : ''}`}>
            {done && <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>}
          </div>
        </div>
      )
    })

  return (
    <div className="px-4 space-y-5 pb-6">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sun size={14} className="text-amber-400" />
          <p className="text-xs font-bold text-[rgb(var(--text-secondary))] uppercase tracking-widest">Утренняя рутина</p>
        </div>
        <div className="space-y-2">{renderList(SKINCARE_MORNING, 'am')}</div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Moon size={14} className="text-[rgb(var(--color-aura-purple))]" />
          <p className="text-xs font-bold text-[rgb(var(--text-secondary))] uppercase tracking-widest">Вечерняя рутина</p>
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
    // Store interval in closure; stop on re-click
    const stop = () => {
      clearInterval(interval)
      setActiveTimer(null)
      haptic.success()
    }
    setTimeout(stop, 600_000) // max 10 min
    // Expose stop fn — simplistic for MVP
    ;(window as unknown as Record<string, unknown>).__stopTimer__ = stop
  }

  const stopTimer = () => {
    const stop = (window as unknown as Record<string, unknown>).__stopTimer__ as (() => void) | undefined
    stop?.()
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="px-4 space-y-3 pb-6">
      {activeTimer && (
        <div className="card-aura p-4 mb-2 text-center">
          <p className="text-xs text-[rgb(var(--text-muted))] mb-1 uppercase tracking-widest">Таймер активен</p>
          <p className="text-4xl font-black gradient-text">{fmtTime(elapsed)}</p>
          <p className="text-sm text-[rgb(var(--text-secondary))] mt-1">{activeTimer}</p>
          <button onClick={stopTimer} className="btn-ghost mt-3 text-xs">⏹ Завершить</button>
        </div>
      )}
      {MEWING_EXERCISES.map(({ emoji, label, duration, xp }) => (
        <div key={label} className="card-aura p-4 flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">{label}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-[10px] text-[rgb(var(--text-muted))]">⏱ {duration}</p>
              <p className="text-[10px] font-bold text-amber-400">+{xp} XP</p>
            </div>
          </div>
          <button
            onClick={() => activeTimer === label ? stopTimer() : startTimer(label)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTimer === label
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-[rgba(var(--color-aura-purple),0.15)] text-[rgb(var(--color-aura-purple))] border border-[rgba(var(--color-aura-purple),0.3)]'
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
      <div className="px-4 pt-8 pb-4">
        <p className="text-xs font-bold text-[rgb(var(--text-muted))] uppercase tracking-widest mb-1">Модуль</p>
        <h1 className="text-2xl font-black text-[rgb(var(--text-primary))]">
          Лицо <span className="gradient-text">&</span> Кожа
        </h1>
      </div>

      {/* Tab Bar */}
      <div className="px-4 mb-1">
        <div className="flex gap-2 p-1 bg-[rgb(var(--bg-card))] rounded-2xl border border-[rgba(var(--border-subtle),0.6)]">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { haptic.light(); setActiveTab(id) }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                activeTab === id
                  ? 'bg-[rgba(var(--color-aura-purple),0.9)] text-white shadow-md'
                  : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'scanner'  && <FaceScanner />}
      {activeTab === 'skincare' && <SkincareTab />}
      {activeTab === 'mewing'   && <MewingTab />}
    </div>
  )
}
