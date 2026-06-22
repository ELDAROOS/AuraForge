'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Camera, Check, Loader2, AlertCircle, UserCircle2 } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useTelegram } from '@/hooks/useTelegram'

interface EditProfileSheetProps {
  onClose: () => void
}

const USERNAME_REGEX = /^[a-z0-9_]{3,32}$/

// ── Client-side image resize ──────────────────────────────────────
async function resizeImage(file: File, maxPx = 512): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)

      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) => resolve(new File([blob!], 'avatar.jpg', { type: 'image/jpeg' })),
        'image/jpeg',
        0.88
      )
    }
    img.src = url
  })
}

// ─────────────────────────────────────────────────────────────────

export function EditProfileSheet({ onClose }: EditProfileSheetProps) {
  const { dbUser, setDbUser } = useAppStore()
  const { tgUser, haptic }    = useTelegram()

  const tgId = tgUser?.id ?? dbUser?.tg_id

  // ── State ─────────────────────────────────────────────────────
  const [username,  setUsername]  = useState(dbUser?.tg_username ?? '')
  const [avatarSrc, setAvatarSrc] = useState<string | null>(dbUser?.avatar_url ?? tgUser?.photo_url ?? null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [globalError, setGlobalError]  = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  // ── Validate username on change ───────────────────────────────
  const handleUsernameChange = (val: string) => {
    const lower = val.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(lower)
    setUsernameError(null)

    if (lower.length > 0 && lower.length < 3) {
      setUsernameError('Минимум 3 символа')
    } else if (lower.length > 32) {
      setUsernameError('Максимум 32 символа')
    }
  }

  // ── Pick image file ───────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview immediately
    setAvatarSrc(URL.createObjectURL(file))

    // Resize before upload
    try {
      const resized = await resizeImage(file, 512)
      setPendingFile(resized)
    } catch {
      setPendingFile(file)
    }
  }, [])

  // ── Upload avatar to Supabase Storage ─────────────────────────
  const uploadAvatar = useCallback(async (file: File): Promise<string | null> => {
    if (!tgId) return null
    setAvatarUploading(true)

    const form = new FormData()
    form.append('file',   file)
    form.append('tg_id',  String(tgId))

    try {
      const res = await fetch('/api/upload-avatar', { method: 'POST', body: form })
      const json = await res.json()

      if (!res.ok) throw new Error(json.error ?? 'Upload failed')

      if (json.user) setDbUser(json.user)
      return json.avatar_url as string
    } catch (err) {
      throw err
    } finally {
      setAvatarUploading(false)
    }
  }, [tgId, setDbUser])

  // ── Save everything ───────────────────────────────────────────
  const handleSave = async () => {
    if (usernameError || !tgId) return

    // Validate username if changed
    if (username && !USERNAME_REGEX.test(username)) {
      setUsernameError('Только a–z, 0–9, _ (3–32 символа)')
      return
    }

    setSaving(true)
    setGlobalError(null)

    try {
      // 1. Upload avatar if new file selected
      if (pendingFile) {
        await uploadAvatar(pendingFile)
        setPendingFile(null)
      }

      // 2. Update username if changed
      const currentUsername = dbUser?.tg_username ?? ''
      if (username && username !== currentUsername) {
        const res = await fetch('/api/user', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tg_id: tgId, tg_username: username }),
        })
        const json = await res.json()

        if (!res.ok) {
          if (res.status === 409) setUsernameError('Username уже занят')
          else setGlobalError(json.error ?? 'Ошибка сохранения')
          return
        }
        if (json.user) setDbUser(json.user)
      }

      haptic.success()
      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
        onClose()
      }, 900)
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Ошибка сети')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges =
    pendingFile !== null ||
    (username !== (dbUser?.tg_username ?? '') && username.length >= 3)

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950 rounded-t-3xl border-t border-zinc-800 p-6 space-y-6 animate-in slide-in-from-bottom-4 duration-300">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">ПРОФИЛЬ</p>
            <h2 className="text-lg font-black text-zinc-100 uppercase tracking-tight mt-0.5">
              Редактировать
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Avatar upload */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative group"
          >
            <div className="w-24 h-24 rounded-full border-2 border-zinc-800 overflow-hidden bg-zinc-900 flex items-center justify-center">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt="avatar"
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                />
              ) : (
                <UserCircle2 size={40} className="text-zinc-700" />
              )}
            </div>

            {/* Camera overlay */}
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
              {avatarUploading ? (
                <Loader2 size={22} className="text-zinc-100 animate-spin opacity-0 group-hover:opacity-100 transition-opacity" />
              ) : (
                <Camera size={22} className="text-zinc-100 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          </button>

          <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
            {avatarUploading ? 'ЗАГРУЗКА...' : 'НАЖМИ ДЛЯ СМЕНЫ ФОТО'}
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Username field */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
            USERNAME
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm pointer-events-none">
              @
            </span>
            <input
              type="text"
              value={username}
              onChange={e => handleUsernameChange(e.target.value)}
              placeholder="твой_ник"
              maxLength={32}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={`w-full pl-8 pr-4 py-3.5 rounded-2xl bg-zinc-800 border text-sm font-bold text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-white transition-all ${
                usernameError ? 'border-red-500/60' : 'border-zinc-700 focus:border-zinc-500'
              }`}
            />
            {username.length >= 3 && !usernameError && (
              <Check size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500" />
            )}
          </div>

          {usernameError && (
            <div className="flex items-center gap-2">
              <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
              <p className="text-[11px] text-red-400 font-bold">{usernameError}</p>
            </div>
          )}
          <p className="text-[10px] text-zinc-600">
            Только латиница, цифры, подчёркивание. 3–32 символа.
          </p>
        </div>

        {/* Global error */}
        {globalError && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-950/30 border border-red-800/40">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-300 font-bold">{globalError}</p>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || !!usernameError || !hasChanges}
          className={`w-full py-4 rounded-2xl font-bold text-sm tracking-widest uppercase transition-all ${
            saveSuccess
              ? 'bg-emerald-500 text-black'
              : hasChanges && !usernameError
                ? 'bg-zinc-100 text-black hover:bg-white active:scale-[0.98]'
                : 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Сохраняем...
            </span>
          ) : saveSuccess ? (
            <span className="flex items-center justify-center gap-2">
              <Check size={16} strokeWidth={3} />
              Сохранено
            </span>
          ) : 'Сохранить'}
        </button>
      </div>
    </>
  )
}
