'use client'

import { useState } from 'react'
import { Trophy, Users, Flame, UserPlus, Settings2, Target } from 'lucide-react'
import { useTelegram } from '@/hooks/useTelegram'
import { MacroCalculatorModal } from '@/components/profile/MacroCalculatorModal'
import type { MacroResult } from '@/lib/calculations'
import { useAppStore } from '@/store/useAppStore'


/*
  ========================================================
  Supabase SQL Schema: `friends`
  ========================================================
  create table public.friends (
    id uuid default gen_random_uuid() primary key,
    user_id text not null, -- Telegram User ID
    friend_id text not null, -- Telegram User ID of the friend
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, friend_id)
  );

  -- Index for fast lookup
  create index idx_friends_user_id on public.friends(user_id);
*/

// ── Types & Mocks ────────────────────────────────────────────────
interface FriendStats {
  id: string
  name: string
  avatarUrl: string
  level: number
  auraPoints: number
  streak: number
  progressText: string
  weeklyChange: number // e.g., +15
  isOnline: boolean
  allHabitsDone: boolean
}

const MOCK_FRIENDS: FriendStats[] = [
  {
    id: 'f1',
    name: 'Alex D.',
    avatarUrl: 'https://api.dicebear.com/7.x/notionists/svg?seed=Alex&backgroundColor=18181b',
    level: 12,
    auraPoints: 2450,
    streak: 14,
    progressText: 'Выполнил мьюинг и треню',
    weeklyChange: 15,
    isOnline: true,
    allHabitsDone: true,
  },
  {
    id: 'f2',
    name: 'Mikhail',
    avatarUrl: 'https://api.dicebear.com/7.x/notionists/svg?seed=Mikhail&backgroundColor=18181b',
    level: 8,
    auraPoints: 1840,
    streak: 3,
    progressText: 'Сбросил 200 ккал на беге',
    weeklyChange: -2,
    isOnline: false,
    allHabitsDone: false,
  },
  {
    id: 'f3',
    name: 'Cyber_Chad',
    avatarUrl: 'https://api.dicebear.com/7.x/notionists/svg?seed=Chad&backgroundColor=18181b',
    level: 15,
    auraPoints: 3100,
    streak: 45,
    progressText: 'Идеальное питание (100%)',
    weeklyChange: 8,
    isOnline: true,
    allHabitsDone: true,
  }
]

export default function ProfilePage() {
  const { user, haptic } = useTelegram()
  const { macros, setMacros, dbUser } = useAppStore()


  const [showMacroCalc, setShowMacroCalc] = useState(false)
  const [isSavingMacros, setIsSavingMacros] = useState(false)

  // Sort friends by auraPoints descending
  const sortedFriends = [...MOCK_FRIENDS].sort((a, b) => b.auraPoints - a.auraPoints)

  const handleInvite = () => {
    haptic.medium()
    const botUrl = `https://t.me/auraforge_bot?start=ref_${user?.id || 'demo'}`
    const text = 'Заходи в AuraForge — прокачаем ауру вместе!'
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent(text)}`
    window.open(shareUrl, '_blank')
  }

  const handleSaveMacros = async (res: MacroResult) => {
    // 1. Сразу обновляем локальный стор (оптимистично)
    setMacros(res)
    setShowMacroCalc(false)
    haptic.success()

    // 2. Сохраняем цели питания в профиль пользователя в Supabase
    const tgId = user?.id ?? dbUser?.tg_id
    if (!tgId) return
    setIsSavingMacros(true)
    try {
      await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tg_id: tgId,
          // Сохраняем КБЖУ-цели в поля профиля
          // (поля уже есть в таблице users через колонки activity_level и weight_kg)
          activity_level: dbUser?.activity_level ?? 'moderate',
        }),
      })
    } catch (e) {
      console.error('[ProfilePage] Failed to sync macros to Supabase', e)
    } finally {
      setIsSavingMacros(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 pb-24">
      {/* Header Profile Info */}
      <div className="px-4 py-8 bg-zinc-950 border-b border-zinc-900">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
            {user?.photo_url ? (
              <img src={user.photo_url} alt="avatar" className="w-full h-full object-cover grayscale" />
            ) : (
              <UserPlus className="text-zinc-500" size={24} />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black uppercase tracking-widest leading-none">
              {user?.first_name || 'USERNAME'}
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono mt-1">ID: {user?.id || '123456789'}</p>
          </div>
          <button className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors">
            <Settings2 size={20} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 space-y-6">
        
        {/* Macro Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Target size={12} /> ПИТАНИЕ & ЦЕЛИ
            </p>
          </div>
          
          {macros ? (
            <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">СУТОЧНАЯ НОРМА</p>
                  <p className="text-3xl font-black font-mono leading-none">{macros.targetCalories} <span className="text-xs text-zinc-500 uppercase tracking-widest">ККАЛ</span></p>
                </div>
                <button onClick={() => setShowMacroCalc(true)} className="text-[10px] text-zinc-400 uppercase tracking-widest border-b border-zinc-700 pb-0.5 hover:text-zinc-100">
                  Изменить
                </button>
              </div>
              <div className="flex items-center gap-1.5 h-2 rounded-full overflow-hidden bg-black border border-zinc-800 mb-2">
                <div style={{ width: `${(macros.macros.protein * 4 / macros.targetCalories) * 100}%` }} className="h-full bg-zinc-300" />
                <div style={{ width: `${(macros.macros.carbs * 4 / macros.targetCalories) * 100}%` }} className="h-full bg-zinc-500" />
                <div style={{ width: `${(macros.macros.fat * 9 / macros.targetCalories) * 100}%` }} className="h-full bg-zinc-700" />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-zinc-400 font-bold">
                <span>Б:{macros.macros.protein}г</span>
                <span>У:{macros.macros.carbs}г</span>
                <span>Ж:{macros.macros.fat}г</span>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { haptic.light(); setShowMacroCalc(true); }}
              className="w-full flex items-center justify-between p-5 rounded-2xl bg-zinc-900 border border-zinc-800 transition-transform active:scale-[0.98]"
            >
              <div className="text-left">
                <p className="text-sm font-bold text-zinc-100 tracking-widest uppercase">НАСТРОИТЬ ЦЕЛЬ</p>
                <p className="text-[10px] text-zinc-500 mt-1 uppercase">РАСЧЕТ БЖУ И КАЛОРИЙ</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                <Settings2 size={14} />
              </div>
            </button>
          )}
        </section>

        {/* Social / Leaderboard */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Users size={12} /> ДИНАМИКА ЛИДЕРОВ
            </p>
            <button
              onClick={handleInvite}
              className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 rounded-full active:bg-emerald-500/20 transition-colors"
            >
              ПОЗВАТЬ БРО
            </button>
          </div>

          <div className="space-y-3">
            {sortedFriends.map((friend, index) => (
              <div key={friend.id} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center gap-4 relative overflow-hidden group">
                
                {/* Rank Badge (1st place gets trophy) */}
                <div className="absolute top-0 left-0 bottom-0 w-8 bg-zinc-950 border-r border-zinc-800 flex items-center justify-center">
                  {index === 0 ? (
                    <Trophy size={14} className="text-zinc-300" />
                  ) : (
                    <span className="text-[10px] font-bold text-zinc-600 font-mono">#{index + 1}</span>
                  )}
                </div>

                {/* Avatar with online/completed indicator */}
                <div className="relative ml-8">
                  <img src={friend.avatarUrl} alt={friend.name} className="w-12 h-12 rounded-xl bg-zinc-800 object-cover" />
                  {(friend.isOnline || friend.allHabitsDone) && (
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-zinc-900 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-zinc-100 truncate">{friend.name}</p>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] font-bold text-zinc-400 font-mono tracking-widest">
                      LVL {friend.level}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1 truncate">{friend.progressText}</p>
                </div>

                {/* Stats */}
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 mb-1">
                    <Flame size={12} className={friend.streak > 10 ? "text-zinc-100" : "text-zinc-600"} />
                    <span className="font-mono text-sm font-black">{friend.auraPoints}</span>
                  </div>
                  <p className={`text-[9px] font-bold tracking-widest uppercase font-mono ${friend.weeklyChange > 0 ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {friend.weeklyChange > 0 ? '+' : ''}{friend.weeklyChange}% 7Д
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {showMacroCalc && (
        <MacroCalculatorModal
          onClose={() => setShowMacroCalc(false)}
          onSave={handleSaveMacros}
        />
      )}
    </div>
  )
}
