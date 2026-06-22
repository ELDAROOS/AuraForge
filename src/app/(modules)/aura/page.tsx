'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Trophy, Users, Flame, UserPlus, Pencil,
  Target, Zap, ChevronRight, RefreshCw,
} from 'lucide-react'
import { useTelegram } from '@/hooks/useTelegram'
import { MacroCalculatorModal, type BiometricData } from '@/components/profile/MacroCalculatorModal'
import { EditProfileSheet } from '@/components/profile/EditProfileSheet'
import { FriendSearch } from '@/components/profile/FriendSearch'
import type { MacroResult } from '@/lib/calculations'
import { useAppStore } from '@/store/useAppStore'
import { xpForNextLevel } from '@/lib/nutrition/tdee'

// ─── Types ────────────────────────────────────────────────────────

interface FriendRow {
  tg_id: number
  first_name: string
  last_name: string | null
  tg_username: string | null
  avatar_url: string | null
  aura_points: number
  aura_level: number
  current_streak: number
  last_active_date: string | null
  isSelf?: boolean
}

// ─── Sub-components ───────────────────────────────────────────────

/** Circular avatar with optional active indicator */
function Avatar({
  url, name, size = 'md', active = false,
}: {
  url: string | null; name: string; size?: 'sm' | 'md' | 'lg'; active?: boolean
}) {
  const dim = { sm: 'w-9 h-9', md: 'w-10 h-10', lg: 'w-16 h-16' }[size]
  const initials = name[0]?.toUpperCase() ?? '?'

  return (
    <div className={`relative flex-shrink-0 ${dim}`}>
      <div className={`${dim} rounded-full border border-zinc-800 overflow-hidden bg-zinc-800 flex items-center justify-center`}>
        {url ? (
          <img
            src={url}
            alt={name}
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <span className={`font-black text-zinc-400 ${size === 'lg' ? 'text-xl' : 'text-xs'}`}>
            {initials}
          </span>
        )}
      </div>
      {active && (
        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-zinc-950 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, unit, icon: Icon }: {
  label: string; value: string | number; unit?: string; icon: React.ElementType
}) {
  return (
    <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className="text-zinc-600" />
        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black text-zinc-100 mono-number leading-none tabular-nums">{value}</span>
        {unit && <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">{unit}</span>}
      </div>
    </div>
  )
}

function LeaderboardRow({ friend, rank }: { friend: FriendRow; rank: number }) {
  const today = new Date().toISOString().split('T')[0]
  const isActive = friend.last_active_date === today

  return (
    <div className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
      friend.isSelf ? 'bg-zinc-800/60 border-zinc-600' : 'bg-zinc-900 border-zinc-800'
    }`}>
      {/* Rank */}
      <div className="w-7 flex items-center justify-center flex-shrink-0">
        {rank === 1
          ? <Trophy size={14} className="text-zinc-300" />
          : <span className="text-[10px] font-bold text-zinc-600 mono-number">#{rank}</span>
        }
      </div>

      {/* Avatar */}
      <Avatar
        url={friend.avatar_url}
        name={friend.first_name}
        size="md"
        active={isActive}
      />

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-zinc-100 truncate">
            {friend.first_name}{friend.last_name ? ` ${friend.last_name}` : ''}
          </p>
          {friend.isSelf && (
            <span className="text-[8px] font-bold text-zinc-500 uppercase border border-zinc-700 px-1 py-0.5 rounded flex-shrink-0">
              ВЫ
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {friend.tg_username && (
            <span className="text-[9px] text-zinc-600 font-mono">@{friend.tg_username}</span>
          )}
          <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
            LVL {friend.aura_level}
          </span>
          {friend.current_streak > 0 && (
            <div className="flex items-center gap-0.5">
              <Flame size={9} className="text-zinc-600" />
              <span className="text-[9px] text-zinc-600 mono-number">{friend.current_streak}д</span>
            </div>
          )}
        </div>
      </div>

      {/* Points */}
      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-1">
          <Zap size={10} className="text-zinc-500" />
          <span className="text-sm font-black text-zinc-100 mono-number tabular-nums">
            {friend.aura_points.toLocaleString()}
          </span>
        </div>
        <p className="text-[9px] text-zinc-600 uppercase tracking-wider mt-0.5">XP</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user: tgUser, haptic } = useTelegram()
  const { macros, setMacros, dbUser, setDbUser } = useAppStore()

  const [showMacroCalc, setShowMacroCalc]   = useState(false)
  const [showEditSheet, setShowEditSheet]   = useState(false)
  const [showFriendSearch, setShowFriendSearch] = useState(false)

  const [friends, setFriends]           = useState<FriendRow[]>([])
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [isSaving, setIsSaving]         = useState(false)

  const tgId = tgUser?.id ?? dbUser?.tg_id ?? null

  // ── Derived avatar: prefer dbUser (may be updated) over tgUser photo ──
  const displayAvatar = dbUser?.avatar_url ?? tgUser?.photo_url ?? null
  const displayName   = tgUser?.first_name ?? dbUser?.first_name ?? 'ANONYMOUS'
  const displayHandle = dbUser?.tg_username ?? tgUser?.username ?? null

  // ── XP progress ────────────────────────────────────────────────
  const level   = dbUser?.aura_level ?? 1
  const points  = dbUser?.aura_points ?? 0
  const streak  = dbUser?.current_streak ?? 0
  const nextXp  = xpForNextLevel(level)
  const prevXp  = xpForNextLevel(level - 1)
  const progress = points >= nextXp
    ? 100
    : Math.round(((points - prevXp) / (nextXp - prevXp)) * 100)

  // ── Load friends ───────────────────────────────────────────────
  const loadFriends = useCallback(async () => {
    if (!tgId) { setFriendsLoading(false); return }
    setFriendsLoading(true)
    try {
      const res = await fetch(`/api/friends?tg_id=${tgId}`)
      if (res.ok) {
        const { friends: data } = await res.json()
        setFriends(data ?? [])
      }
    } catch (e) {
      console.error('[ProfilePage] loadFriends failed', e)
    } finally {
      setFriendsLoading(false)
    }
  }, [tgId])

  useEffect(() => { loadFriends() }, [loadFriends])

  // ── Invite link ────────────────────────────────────────────────
  const handleInvite = () => {
    haptic.medium()
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://auraforge.app'
    const deepLink = `${appUrl}?startapp=invite_${tgId}`
    const text     = 'Догоняй — прокачиваю ауру в AuraForge 🔥'
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(text)}`,
      '_blank'
    )
  }

  // ── Save biometrics (macro calculator) ────────────────────────
  const handleSaveMacros = async (res: MacroResult, bio: BiometricData) => {
    setMacros(res)
    setShowMacroCalc(false)
    haptic.success()

    if (!tgId) return
    setIsSaving(true)
    try {
      const resp = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tg_id: tgId,
          age: bio.age,
          gender: bio.gender,
          height_cm: bio.height,
          weight_kg: bio.weight,
          activity_level: bio.activity,
        }),
      })
      if (resp.ok) {
        const { user: updated } = await resp.json()
        if (updated) setDbUser(updated)
      }
    } catch (e) {
      console.error('[ProfilePage] saveMacros failed', e)
    } finally {
      setIsSaving(false)
    }
  }

  // ── Leaderboard ────────────────────────────────────────────────
  const selfRow: FriendRow | null = dbUser ? {
    tg_id:            dbUser.tg_id,
    first_name:       dbUser.first_name,
    last_name:        dbUser.last_name ?? null,
    tg_username:      dbUser.tg_username ?? null,
    avatar_url:       dbUser.avatar_url ?? null,
    aura_points:      dbUser.aura_points,
    aura_level:       dbUser.aura_level,
    current_streak:   dbUser.current_streak,
    last_active_date: dbUser.last_active_date ?? null,
    isSelf:           true,
  } : null

  const leaderboard = [
    ...(selfRow ? [selfRow] : []),
    ...friends,
  ].sort((a, b) => b.aura_points - a.aura_points)

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="page-enter min-h-full bg-black text-zinc-100 pb-32">

      {/* ── Header ── */}
      <div className="px-4 pt-10 pb-6">

        {/* Avatar + name row */}
        <div className="flex items-center gap-4 mb-6">
          {/* Clickable avatar → edit profile */}
          <button
            onClick={() => { haptic.light(); setShowEditSheet(true) }}
            className="relative group flex-shrink-0"
            aria-label="Редактировать профиль"
          >
            <Avatar url={displayAvatar} name={displayName} size="lg" />
            {/* Edit overlay */}
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
              <Pencil size={18} className="text-zinc-100 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>

          <div className="flex-1 min-w-0">
            <p className="mono-heading mb-0.5">Профиль</p>
            <h1 className="text-2xl font-black uppercase tracking-tight leading-tight truncate">
              {displayName}
            </h1>
            {displayHandle && (
              <p className="text-[10px] text-zinc-600 mono-number mt-0.5">@{displayHandle}</p>
            )}
          </div>

          {/* Edit button */}
          <button
            onClick={() => { haptic.light(); setShowEditSheet(true) }}
            className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-100 transition-colors flex-shrink-0"
            aria-label="Настройки профиля"
          >
            <Pencil size={16} />
          </button>
        </div>

        {/* Stat tiles */}
        <div className="flex gap-3 mb-4">
          <StatTile label="Уровень" value={`LVL ${level}`} icon={Zap} />
          <StatTile label="Аура XP" value={points.toLocaleString()} unit="XP" icon={Zap} />
          <StatTile label="Стрик"   value={streak} unit="д" icon={Flame} />
        </div>

        {/* XP bar */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <div className="flex justify-between text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2">
            <span>До уровня {level + 1}</span>
            <span className="mono-number">{progress}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-zinc-100 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[9px] text-zinc-700 mono-number mt-2">
            {(nextXp - points).toLocaleString()} XP до следующего уровня
          </p>
        </div>
      </div>

      {/* ── Biometrics / Nutrition ── */}
      <div className="px-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Target size={11} className="text-zinc-600" />
          <p className="mono-heading">Питание и биометрия</p>
        </div>

        {macros ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="mono-heading mb-1">Суточная норма</p>
                <p className="text-3xl font-black mono-number leading-none">
                  {macros.targetCalories}
                  <span className="text-sm text-zinc-600 ml-1.5 font-bold uppercase tracking-wider">ккал</span>
                </p>
              </div>
              <button
                onClick={() => { haptic.light(); setShowMacroCalc(true) }}
                className="text-[10px] text-zinc-500 uppercase tracking-widest border-b border-zinc-700 hover:text-zinc-100 transition-colors pb-0.5"
              >
                Изменить
              </button>
            </div>

            <div className="h-2 rounded-full overflow-hidden bg-black border border-zinc-800 flex mb-3">
              <div className="h-full bg-zinc-200" style={{ width: `${(macros.macros.protein * 4 / macros.targetCalories) * 100}%` }} />
              <div className="h-full bg-zinc-500" style={{ width: `${(macros.macros.carbs * 4 / macros.targetCalories) * 100}%` }} />
              <div className="h-full bg-zinc-700" style={{ width: `${(macros.macros.fat * 9 / macros.targetCalories) * 100}%` }} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Белки',    value: macros.macros.protein },
                { label: 'Углеводы', value: macros.macros.carbs },
                { label: 'Жиры',     value: macros.macros.fat },
              ].map(({ label, value }) => (
                <div key={label} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-center">
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-base font-black text-zinc-100 mono-number">
                    {value}<span className="text-[10px] text-zinc-600 ml-0.5">г</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={() => { haptic.light(); setShowMacroCalc(true) }}
            className="w-full flex items-center justify-between p-5 rounded-2xl bg-zinc-900 border border-zinc-800 active:scale-[0.98] transition-all"
          >
            <div className="text-left">
              <p className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Настроить профиль</p>
              <p className="text-[10px] text-zinc-600 mt-1 uppercase tracking-wide">Расчёт КБЖУ по биометрии</p>
            </div>
            <ChevronRight size={18} className="text-zinc-600" />
          </button>
        )}
      </div>

      {/* ── Friend Search ── */}
      <div className="px-4 mb-6">
        <button
          onClick={() => setShowFriendSearch(v => !v)}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-zinc-900 border border-zinc-800 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-2">
            <UserPlus size={14} className="text-zinc-500" />
            <span className="text-sm font-bold text-zinc-100 uppercase tracking-wider">Найти друга</span>
          </div>
          <ChevronRight
            size={16}
            className={`text-zinc-600 transition-transform ${showFriendSearch ? 'rotate-90' : ''}`}
          />
        </button>

        {showFriendSearch && (
          <div className="mt-3">
            <FriendSearch
              myTgId={tgId}
              onFriendAdded={() => {
                haptic.success()
                setTimeout(loadFriends, 500)   // refresh leaderboard
              }}
            />
          </div>
        )}
      </div>

      {/* ── Aura Board (Leaderboard) ── */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={11} className="text-zinc-600" />
            <p className="mono-heading">Aura Board</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { haptic.light(); loadFriends() }}
              className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 hover:text-zinc-100 transition-colors"
              aria-label="Обновить"
            >
              <RefreshCw size={12} />
            </button>
            <button
              onClick={handleInvite}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-emerald-400 uppercase tracking-widest border border-emerald-500/20 bg-emerald-500/10 active:bg-emerald-500/20 transition-colors"
            >
              <UserPlus size={11} />
              Позвать бро
            </button>
          </div>
        </div>

        {friendsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <Users size={32} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-1">Список пуст</p>
            <p className="text-[10px] text-zinc-700 leading-relaxed">
              Используй поиск или позови друзей по ссылке
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((friend, index) => (
              <LeaderboardRow key={friend.tg_id} friend={friend} rank={index + 1} />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showMacroCalc && (
        <MacroCalculatorModal
          onClose={() => setShowMacroCalc(false)}
          onSave={handleSaveMacros}
        />
      )}

      {showEditSheet && (
        <EditProfileSheet onClose={() => setShowEditSheet(false)} />
      )}

      {/* Saving indicator */}
      {isSaving && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-700 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
          Сохраняем…
        </div>
      )}
    </div>
  )
}
