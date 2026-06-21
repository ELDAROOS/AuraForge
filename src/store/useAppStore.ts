'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { DbUser } from '@/types/database'
import { TelegramUser } from '@/types/telegram'
import { MacroResult } from '@/lib/calculations'

interface AppState {
  // ─── Auth ────────────────────────────────
  dbUser: DbUser | null
  tgUser: TelegramUser | null
  isLoading: boolean

  // ─── Aura ────────────────────────────────
  pendingXp: number   // XP накопленный в текущей сессии (до записи в БД)

  // ─── Nutrition ───────────────────────────
  macros: MacroResult | null

  // ─── Actions ─────────────────────────────
  setDbUser: (user: DbUser) => void
  setTgUser: (user: TelegramUser) => void
  setLoading: (loading: boolean) => void
  addPendingXp: (amount: number) => void
  flushPendingXp: () => void
  updateAuraPoints: (points: number, level: number) => void
  setMacros: (macros: MacroResult) => void
}

export const useAppStore = create<AppState>()(
  persist(
    immer((set) => ({
      dbUser: null,
      tgUser: null,
      isLoading: true,
      pendingXp: 0,
      macros: null,

      setDbUser: (user) => set((state) => { state.dbUser = user }),
      setTgUser: (user) => set((state) => { state.tgUser = user }),
      setLoading: (loading) => set((state) => { state.isLoading = loading }),

      addPendingXp: (amount) => set((state) => {
        state.pendingXp += amount
      }),

      flushPendingXp: () => set((state) => {
        state.pendingXp = 0
      }),

      updateAuraPoints: (points, level) => set((state) => {
        if (state.dbUser) {
          state.dbUser.aura_points = points
          state.dbUser.aura_level = level
        }
      }),

      setMacros: (macros) => set((state) => {
        state.macros = macros
      }),
    })),
    {
      name: 'auraforge-store',       // ключ в localStorage
      storage: createJSONStorage(() => localStorage),
      // tgUser не сохраняем — он всегда приходит заново из Telegram SDK
      // isLoading тоже не сохраняем — всегда стартует с true
      partialize: (state) => ({
        dbUser: state.dbUser,
        macros: state.macros,
        pendingXp: state.pendingXp,
      }),
    }
  )
)
