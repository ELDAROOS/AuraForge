'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, X, Loader2, Plus, Check, ChevronDown, ScanLine, Zap, Tag } from 'lucide-react'
import { calcNutrition, getProductByBarcode, searchFood } from '@/lib/nutrition/openFoodFacts'
import { searchLocalFood } from '@/lib/nutrition/food-db'
import type { FoodItem } from '@/types/nutrition'
import { BarcodeScanner } from './BarcodeScanner'

// ─── Portion System ────────────────────────────────────────────────
export type PortionKey =
  | 'grams'
  | 'standard'
  | 'glass'
  | 'handful'
  | 'tablespoon'

interface Portion {
  key: PortionKey
  label: string
  sublabel: string   // hint shown under the label
  grams: number      // default gram equivalent (multiplier base)
  allowCustom: boolean  // grams — user types freely; rest — fixed
}

export const PORTIONS: Portion[] = [
  { key: 'grams',      label: 'Граммы',     sublabel: 'ввод вручную',      grams: 1,   allowCustom: true  },
  { key: 'standard',   label: 'Порция',     sublabel: '≈ 150 г (штука)',   grams: 150, allowCustom: false },
  { key: 'glass',      label: 'Стакан',     sublabel: '≈ 250 г',           grams: 250, allowCustom: false },
  { key: 'handful',    label: 'Горсть',     sublabel: '≈ 30 г',            grams: 30,  allowCustom: false },
  { key: 'tablespoon', label: 'Ложка',      sublabel: '≈ 15 г (стол.)',    grams: 15,  allowCustom: false },
]

function getGrams(portion: Portion, customGrams: number, count: number): number {
  if (portion.allowCustom) return Math.max(1, customGrams)
  return portion.grams * Math.max(1, count)
}

// ─── MacroBar ─────────────────────────────────────────────────────
function MacroBar({ label, value, unit, pct }: {
  label: string; value: number; unit: string; pct: number
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
        <span className="text-sm font-bold text-zinc-100 font-mono">{value}{unit}</span>
      </div>
      <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-zinc-100 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}

// ─── PortionSelector ──────────────────────────────────────────────
function PortionSelector({
  selected, count, customGrams,
  onSelect, onCountChange, onGramsChange,
}: {
  selected: Portion
  count: number
  customGrams: number
  onSelect: (p: Portion) => void
  onCountChange: (n: number) => void
  onGramsChange: (g: number) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-3">
      {/* Dropdown trigger */}
      <div className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
        >
          <div className="text-left">
            <p className="text-sm font-bold text-zinc-100">{selected.label}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{selected.sublabel}</p>
          </div>
          <ChevronDown
            size={16}
            className={`text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown menu */}
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1.5 z-20 rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-xl shadow-black/60">
            {PORTIONS.map(p => (
              <button
                key={p.key}
                onClick={() => { onSelect(p); setOpen(false) }}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-zinc-800 ${
                  selected.key === p.key ? 'bg-zinc-800' : ''
                }`}
              >
                <div>
                  <p className={`text-sm font-bold ${selected.key === p.key ? 'text-zinc-100' : 'text-zinc-300'}`}>
                    {p.label}
                  </p>
                  <p className="text-[10px] text-zinc-500">{p.sublabel}</p>
                </div>
                {selected.key === p.key && (
                  <div className="w-4 h-4 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-black" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Amount input row */}
      <div className="flex items-center gap-3">
        {selected.allowCustom ? (
          /* Free-form gram input */
          <div className="flex-1 flex items-center gap-2 bg-zinc-900 rounded-2xl border border-zinc-800 px-3 py-2.5">
            <button
              onClick={() => onGramsChange(Math.max(1, customGrams - 10))}
              className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 font-bold text-lg leading-none flex items-center justify-center transition-colors hover:bg-zinc-700 active:scale-95"
            >−</button>
            <input
              type="number"
              inputMode="numeric"
              value={customGrams}
              onChange={e => onGramsChange(Math.max(1, Math.min(5000, Number(e.target.value))))}
              className="flex-1 text-center text-base font-bold text-zinc-100 font-mono bg-transparent focus:outline-none min-w-0"
            />
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex-shrink-0">г</span>
            <button
              onClick={() => onGramsChange(Math.min(5000, customGrams + 10))}
              className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 font-bold text-lg leading-none flex items-center justify-center transition-colors hover:bg-zinc-700 active:scale-95"
            >+</button>
          </div>
        ) : (
          /* Count stepper for fixed portions */
          <div className="flex-1 flex items-center gap-2 bg-zinc-900 rounded-2xl border border-zinc-800 px-3 py-2.5">
            <button
              onClick={() => onCountChange(Math.max(1, count - 1))}
              className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 font-bold text-lg leading-none flex items-center justify-center transition-colors hover:bg-zinc-700 active:scale-95"
            >−</button>
            <div className="flex-1 text-center">
              <p className="text-base font-bold text-zinc-100 font-mono">{count}</p>
              <p className="text-[9px] text-zinc-500 -mt-0.5">{selected.grams * count} г</p>
            </div>
            <button
              onClick={() => onCountChange(Math.min(20, count + 1))}
              className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 font-bold text-lg leading-none flex items-center justify-center transition-colors hover:bg-zinc-700 active:scale-95"
            >+</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── FoodCard with Smart Portions ─────────────────────────────────
function FoodCard({
  item,
  onAdd,
  calorieTarget,
}: {
  item: FoodItem
  onAdd: (item: FoodItem, grams: number) => void
  calorieTarget: number
}) {
  const [portion, setPortion] = useState<Portion>(PORTIONS[0])
  const [customGrams, setCustomGrams] = useState(100)
  const [count, setCount] = useState(1)
  const [added, setAdded] = useState(false)

  const totalGrams = getGrams(portion, customGrams, count)
  const nutrition   = calcNutrition(item, totalGrams)

  const caloriePct = calorieTarget > 0 ? (nutrition.calories / calorieTarget) * 100 : 0
  const proteinMax = (calorieTarget * 0.3) / 4   // 30% of kcal from protein
  const carbsMax   = (calorieTarget * 0.4) / 4   // 40% from carbs
  const fatMax     = (calorieTarget * 0.3) / 9   // 30% from fat

  const handleAdd = () => {
    onAdd(item, totalGrams)
    setAdded(true)
    setTimeout(() => setAdded(false), 2200)
  }

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      {/* Product header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-zinc-800">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-12 h-12 rounded-xl object-cover bg-zinc-800 flex-shrink-0 grayscale"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex-shrink-0 flex items-center justify-center text-xl">
            🍽️
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm text-zinc-100 leading-snug line-clamp-2">{item.name}</p>
            {item.source === 'local' && (
              <Zap size={14} className="text-zinc-400 flex-shrink-0" />
            )}
            {item.source === 'barcode' && (
              <Tag size={14} className="text-zinc-400 flex-shrink-0" />
            )}
          </div>
          {item.brand && (
            <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{item.brand}</p>
          )}
          <p className="text-[10px] text-zinc-600 mt-0.5">
            {item.per100g.calories} ккал / 100г
          </p>
        </div>
      </div>

      {/* Live macro readout */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-800 space-y-1">
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
          В ВЫБРАННОЙ ПОРЦИИ ({totalGrams} Г)
        </p>

        {/* Big calorie number */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-5xl font-black text-zinc-100 font-mono leading-none tracking-tighter">
            {nutrition.calories}
          </span>
          <span className="text-sm font-bold text-zinc-500">ККАЛ</span>
          {caloriePct > 0 && (
            <span className="ml-auto text-[10px] font-bold text-zinc-500 font-mono">
              {caloriePct.toFixed(0)}% от нормы
            </span>
          )}
        </div>

        {/* Macro bars */}
        <div className="space-y-2.5">
          <MacroBar label="Белки"   value={nutrition.protein} unit="г" pct={(nutrition.protein / proteinMax) * 100} />
          <MacroBar label="Углев"   value={nutrition.carbs}   unit="г" pct={(nutrition.carbs / carbsMax) * 100}    />
          <MacroBar label="Жиры"    value={nutrition.fat}     unit="г" pct={(nutrition.fat / fatMax) * 100}        />
        </div>
      </div>

      {/* Portion selector */}
      <div className="px-4 py-4 border-b border-zinc-800">
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
          РАЗМЕР ПОРЦИИ
        </p>
        <PortionSelector
          selected={portion}
          count={count}
          customGrams={customGrams}
          onSelect={p => { setPortion(p); setCount(1) }}
          onCountChange={setCount}
          onGramsChange={setCustomGrams}
        />
      </div>

      {/* Add button */}
      <div className="px-4 py-4">
        <button
          onClick={handleAdd}
          disabled={added}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm tracking-widest uppercase transition-all duration-300 ${
            added
              ? 'bg-zinc-800 border border-zinc-700 text-zinc-400'
              : 'bg-zinc-100 text-black hover:bg-white active:scale-[0.97]'
          }`}
        >
          {added ? (
            <>
              <Check size={16} strokeWidth={3} />
              ДОБАВЛЕНО
            </>
          ) : (
            <>
              <Plus size={16} strokeWidth={2.5} />
              ДОБАВИТЬ
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── SearchBar ────────────────────────────────────────────────────
function SearchBar({ query, isSearching, onQueryChange, onClear, onScannerOpen }: {
  query: string
  isSearching: boolean
  onQueryChange: (v: string) => void
  onClear: () => void
  onScannerOpen: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          {isSearching
            ? <Loader2 size={18} className="text-zinc-400 animate-spin" />
            : <Search size={18} className="text-zinc-500" />
          }
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Искать продукт…"
          className="w-full pl-11 pr-10 py-3.5 rounded-2xl text-sm font-medium
            bg-zinc-900 border border-zinc-800
            text-zinc-100 placeholder:text-zinc-600
            focus:outline-none focus:border-zinc-600 transition-colors"
        />
        {query && (
          <button
            onClick={() => { onClear(); inputRef.current?.focus() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1.5"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <button
        onClick={onScannerOpen}
        className="w-12 flex-shrink-0 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-300 hover:text-zinc-100 transition-colors active:scale-95"
      >
        <ScanLine size={20} />
      </button>
    </div>
  )
}

// ─── Eaten Log Row ─────────────────────────────────────────────────
interface EatenEntry {
  food: FoodItem
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

function EatenRow({ entry, onRemove }: { entry: EatenEntry; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-zinc-100 truncate">{entry.food.name}</p>
          {entry.food.source === 'local' && <Zap size={12} className="text-zinc-500 flex-shrink-0" />}
          {entry.food.source === 'barcode' && <Tag size={12} className="text-zinc-500 flex-shrink-0" />}
        </div>
        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
          {entry.grams}Г · Б{entry.protein} · У{entry.carbs} · Ж{entry.fat}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-zinc-100 font-mono">{entry.calories}</p>
        <p className="text-[9px] text-zinc-500 uppercase tracking-wider">ккал</p>
      </div>
      <button
        onClick={onRemove}
        className="ml-1 w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors opacity-0 group-hover:opacity-100"
      >
        <X size={12} />
      </button>
    </div>
  )
}

// ─── Daily Summary Bar ─────────────────────────────────────────────
function DailySummaryBar({ totals, targets }: {
  totals: { calories: number; protein: number; carbs: number; fat: number }
  targets: { target: number; protein: number; carbs: number; fat: number }
}) {
  const pct = Math.min(100, Math.round((totals.calories / targets.target) * 100))
  const remaining = Math.max(0, targets.target - totals.calories)

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      {/* Calorie summary */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-zinc-800">
        <div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">СЪЕДЕНО</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-3xl font-black text-zinc-100 font-mono leading-none">{totals.calories}</span>
            <span className="text-xs font-bold text-zinc-500">/ {targets.target} ккал</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">ОСТАЛОСЬ</p>
          <p className="text-2xl font-black text-zinc-100 font-mono mt-1">{remaining}</p>
        </div>
      </div>

      {/* Progress fill */}
      <div className="px-5 py-3 border-b border-zinc-800">
        <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
          <span>Прогресс</span>
          <span className="font-mono">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              pct >= 100 ? 'bg-emerald-500' : 'bg-zinc-100'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Macro grid */}
      <div className="grid grid-cols-3 divide-x divide-zinc-800">
        {[
          { label: 'Белки',  value: totals.protein, target: targets.protein },
          { label: 'Углев',  value: totals.carbs,   target: targets.carbs   },
          { label: 'Жиры',   value: totals.fat,     target: targets.fat     },
        ].map(({ label, value, target }) => (
          <div key={label} className="px-4 py-3 text-center">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</p>
            <p className="text-base font-black text-zinc-100 font-mono mt-1">
              {value}<span className="text-xs text-zinc-500">г</span>
            </p>
            <p className="text-[9px] text-zinc-600 font-mono">/ {target}г</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────
export function NutritionTracker({
  calorieTarget = 2000,
  proteinTarget = 150,
  carbsTarget   = 250,
  fatTarget     = 65,
  onEntryAdded,
}: {
  calorieTarget?: number
  proteinTarget?: number
  carbsTarget?: number
  fatTarget?: number
  onEntryAdded?: (entry: EatenEntry) => void
}) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<FoodItem[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [eaten, setEaten]       = useState<EatenEntry[]>([])
  
  const [isScanning, setIsScanning] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Totals
  const totals = eaten.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein:  acc.protein  + e.protein,
      carbs:    acc.carbs    + e.carbs,
      fat:      acc.fat      + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )

  // Debounced hybrid search
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); return }
    setSearching(true)
    setError(null)
    
    try {
      // 1. Try local DB first
      const localResults = searchLocalFood(q)
      if (localResults.length > 0) {
        setResults(localResults)
        setSearching(false)
        return
      }

      // 2. Fallback to Open Food Facts API
      const res = await fetch(`/api/food?q=${encodeURIComponent(q)}&page=1`)
      if (!res.ok) throw new Error('Ошибка сервера')
      const data = await res.json() as { items: FoodItem[]; total: number }
      setResults(data.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка поиска')
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleQuery = useCallback((v: string) => {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(v), 400)
  }, [doSearch])

  const handleClear = useCallback(() => {
    setQuery('')
    setResults([])
    setError(null)
  }, [])

  const handleAdd = useCallback((item: FoodItem, grams: number) => {
    const n = calcNutrition(item, grams)
    const entry: EatenEntry = { food: item, grams, ...n }
    setEaten(prev => [entry, ...prev])
    onEntryAdded?.(entry)
  }, [onEntryAdded])

  const handleRemove = (idx: number) => setEaten(prev => prev.filter((_, i) => i !== idx))

  const handleScanBarcode = useCallback(async (barcode: string) => {
    setIsScanning(false)
    setSearching(true)
    setQuery(barcode)
    setError(null)
    try {
      const res = await fetch(`/api/food?barcode=${encodeURIComponent(barcode)}`)
      if (res.status === 404) {
        setError(`Штрихкод ${barcode} не найден`)
        setResults([])
        return
      }
      if (!res.ok) throw new Error('Ошибка сервера при поиске штрихкода')
      
      const data = await res.json() as { item: FoodItem }
      if (data.item) {
        setResults([data.item])
      } else {
        setError(`Штрихкод ${barcode} не найден`)
        setResults([])
      }
    } catch (e) {
      setError('Ошибка при поиске штрихкода')
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const isShowingResults = query.length >= 2 || results.length > 0

  return (
    <div className="space-y-5 relative">
      {/* Barcode scanner modal */}
      {isScanning && (
        <BarcodeScanner
          onScan={handleScanBarcode}
          onClose={() => setIsScanning(false)}
        />
      )}

      {/* Daily summary — always visible */}
      <DailySummaryBar
        totals={totals}
        targets={{ target: calorieTarget, protein: proteinTarget, carbs: carbsTarget, fat: fatTarget }}
      />

      {/* Eaten log */}
      {eaten.length > 0 && !isShowingResults && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">
            СЕГОДНЯ · {eaten.length} {eaten.length === 1 ? 'ПРОДУКТ' : eaten.length < 5 ? 'ПРОДУКТА' : 'ПРОДУКТОВ'}
          </p>
          {eaten.map((entry, i) => (
            <EatenRow key={i} entry={entry} onRemove={() => handleRemove(i)} />
          ))}
        </div>
      )}

      {/* Search section */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">
          ДОБАВИТЬ ПРОДУКТ
        </p>
        <SearchBar
          query={query}
          isSearching={searching}
          onQueryChange={handleQuery}
          onClear={handleClear}
          onScannerOpen={() => setIsScanning(true)}
        />

        {/* Error */}
        {error && (
          <div className="text-center py-4 text-xs text-red-400 font-bold bg-red-950/20 rounded-2xl border border-red-900/50">
            ⚠️ {error}
          </div>
        )}

        {/* Loading skeleton */}
        {searching && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-2xl bg-zinc-900 border border-zinc-800 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty result */}
        {isShowingResults && !searching && results.length === 0 && !error && (
          <div className="text-center py-10">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Ничего не найдено</p>
            <p className="text-[10px] text-zinc-600 mt-1">Попробуй изменить запрос или сканируй штрихкод</p>
          </div>
        )}

        {/* Search hint */}
        {!isShowingResults && !searching && results.length === 0 && eaten.length === 0 && (
          <div className="text-center py-8">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
              Введи минимум 2 символа для поиска
            </p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && !searching && (
          <div className="space-y-4">
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">
              НАЙДЕНО: {results.length}
            </p>
            {results.map((item, idx) => (
              <FoodCard
                key={`${item.barcode}-${idx}`}
                item={item}
                onAdd={handleAdd}
                calorieTarget={calorieTarget}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export type { EatenEntry }
