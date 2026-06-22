'use client'

import { useState, useCallback, useRef } from 'react'
import { Search, UserPlus, Check, Loader2, X } from 'lucide-react'

interface SearchUser {
  tg_id: number
  first_name: string
  last_name: string | null
  tg_username: string | null
  avatar_url: string | null
  aura_points: number
  aura_level: number
}

interface FriendSearchProps {
  /** tg_id of the current user — needed for search and add */
  myTgId: number | null
  /** Called when a friend is successfully added */
  onFriendAdded?: (userId: number) => void
}

function UserAvatar({ user }: { user: Pick<SearchUser, 'first_name' | 'avatar_url'> }) {
  const initials = user.first_name[0]?.toUpperCase() ?? '?'
  return (
    <div className="w-10 h-10 rounded-full border border-zinc-800 overflow-hidden bg-zinc-800 flex-shrink-0 flex items-center justify-center">
      {user.avatar_url ? (
        <img
          src={user.avatar_url}
          alt={user.first_name}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <span className="text-xs font-black text-zinc-400">{initials}</span>
      )}
    </div>
  )
}

export function FriendSearch({ myTgId, onFriendAdded }: FriendSearchProps) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<SearchUser[]>([])
  const [loading,  setLoading]  = useState(false)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set())
  const [error,    setError]    = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Debounced search ──────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ q })
      if (myTgId) params.set('tg_id', String(myTgId))

      const res = await fetch(`/api/friends/search?${params}`)
      if (!res.ok) throw new Error('Ошибка поиска')

      const { users } = await res.json() as { users: SearchUser[] }
      setResults(users ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка поиска')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [myTgId])

  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 350)
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setError(null)
  }

  // ── Add friend ────────────────────────────────────────────────
  const handleAdd = async (user: SearchUser) => {
    if (!myTgId || addingId === user.tg_id || addedIds.has(user.tg_id)) return

    setAddingId(user.tg_id)
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_tg_id: myTgId, friend_tg_id: user.tg_id }),
      })

      if (!res.ok) throw new Error('Ошибка добавления')

      setAddedIds(prev => new Set(prev).add(user.tg_id))
      onFriendAdded?.(user.tg_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setAddingId(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          {loading
            ? <Loader2 size={16} className="text-zinc-500 animate-spin" />
            : <Search size={16} className="text-zinc-500" />
          }
        </div>
        <input
          type="text"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          placeholder="Поиск по @username или имени..."
          autoCapitalize="none"
          autoCorrect="off"
          className="w-full pl-10 pr-10 py-3.5 rounded-2xl bg-zinc-800 border border-zinc-700 text-sm font-medium text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-white transition-all"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 transition-colors p-1"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-[11px] text-red-400 font-bold px-1">{error}</p>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map(user => {
            const isAdded   = addedIds.has(user.tg_id)
            const isAdding  = addingId === user.tg_id

            return (
              <div
                key={user.tg_id}
                className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900 border border-zinc-800"
              >
                <UserAvatar user={user} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-100 truncate">
                    {user.first_name}{user.last_name ? ` ${user.last_name}` : ''}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    {user.tg_username ? `@${user.tg_username}` : `#${user.tg_id}`}
                    {' · '}LVL {user.aura_level}
                  </p>
                </div>

                <button
                  onClick={() => handleAdd(user)}
                  disabled={isAdded || isAdding}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${
                    isAdded
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-zinc-100 text-black hover:bg-white active:scale-95'
                  }`}
                >
                  {isAdding
                    ? <Loader2 size={12} className="animate-spin" />
                    : isAdded
                      ? <><Check size={12} strokeWidth={3} />Добавлен</>
                      : <><UserPlus size={12} />Add</>
                  }
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state after search */}
      {!loading && query.length >= 2 && results.length === 0 && !error && (
        <div className="text-center py-6">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
            Никого не найдено
          </p>
          <p className="text-[10px] text-zinc-700 mt-1">
            Попробуй другой ник или имя
          </p>
        </div>
      )}
    </div>
  )
}
