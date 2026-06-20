'use client'

interface MacroRingProps {
  /** Consumed calories */
  current: number
  /** Daily target calories */
  target: number
  protein: number
  carbs: number
  fat: number
  proteinTarget: number
  carbsTarget: number
  fatTarget: number
}

interface ArcProps {
  cx: number
  cy: number
  r: number
  ratio: number         // 0..1
  color: string
  strokeWidth: number
  dashOffset: number    // rotation offset
}

function Arc({ cx, cy, r, ratio, color, strokeWidth, dashOffset }: ArcProps) {
  const circumference = 2 * Math.PI * r
  const dash = Math.max(0, Math.min(ratio, 1)) * circumference
  const gap = circumference - dash

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={`${dash} ${gap}`}
      strokeDashoffset={-dashOffset}
      style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
    />
  )
}

export function MacroRing({
  current, target,
  protein, carbs, fat,
  proteinTarget, carbsTarget, fatTarget,
}: MacroRingProps) {
  const SIZE = 180
  const cx = SIZE / 2
  const cy = SIZE / 2
  const START_OFFSET = (Math.PI / 2) * SIZE / 2   // start from 12 o'clock

  const calorieRatio = target > 0 ? Math.min(current / target, 1) : 0

  return (
    <div className="flex flex-col items-center gap-4">
      {/* SVG Ring */}
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="-rotate-90"    // SVG 0° = 3 o'clock; rotate to make 0° = 12 o'clock
        >
          {/* Track rings */}
          <circle cx={cx} cy={cy} r={72} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={14} />
          <circle cx={cx} cy={cy} r={54} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={10} />
          <circle cx={cx} cy={cy} r={38} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={8} />

          {/* Calories ring (outer) */}
          <Arc cx={cx} cy={cy} r={72} ratio={calorieRatio}
            color="url(#grad-cal)" strokeWidth={14} dashOffset={0} />

          {/* Protein ring */}
          <Arc cx={cx} cy={cy} r={54}
            ratio={proteinTarget > 0 ? protein / proteinTarget : 0}
            color="#818cf8" strokeWidth={10} dashOffset={0} />

          {/* Carbs ring */}
          <Arc cx={cx} cy={cy} r={38}
            ratio={carbsTarget > 0 ? carbs / carbsTarget : 0}
            color="#34d399" strokeWidth={8} dashOffset={0} />

          {/* Gradient def */}
          <defs>
            <linearGradient id="grad-cal" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="rgb(139,92,246)" />
              <stop offset="100%" stopColor="rgb(236,72,153)" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <p className="text-2xl font-black gradient-text leading-none">{current}</p>
          <p className="text-[10px] text-[rgb(var(--text-muted))] font-medium uppercase tracking-wider">из {target} ккал</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-5">
        {[
          { label: 'Белки',   value: protein,   target: proteinTarget,   color: '#818cf8' },
          { label: 'Углеводы', value: carbs,    target: carbsTarget,     color: '#34d399' },
          { label: 'Жиры',    value: fat,       target: fatTarget,       color: '#f472b6' },
        ].map(({ label, value, target: t, color }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <p className="text-xs font-bold text-[rgb(var(--text-primary))]">{Math.round(value)}г</p>
            <p className="text-[9px] text-[rgb(var(--text-muted))] uppercase tracking-wide">{label}</p>
            <p className="text-[9px] text-[rgb(var(--text-muted))]">/{t}г</p>
          </div>
        ))}
      </div>
    </div>
  )
}
