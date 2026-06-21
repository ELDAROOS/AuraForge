'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  getFaceMesh, stopStream, getFrontCameraConstraints, type Results,
} from '@/lib/mediapipe/faceMesh'
import {
  averageLandmarks, analyzeLandmarks, scoreToTier,
  TIER_META, type FaceAnalysisResult, type Landmark, type FaceTier,
} from '@/lib/mediapipe/faceAnalytics'
import { useTelegram } from '@/hooks/useTelegram'
import {
  Camera, AlertCircle, Loader2, RotateCcw, ChevronRight,
} from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────
/** How many frames to accumulate before computing the final score */
const TARGET_FRAMES = 40
/** Progress thresholds for UI feedback */
const CAPTURE_PHASES = [
  { at: 0,  label: 'УДЕРЖИ ЛИЦО В РАМКЕ' },
  { at: 30, label: 'ЗАХВАТ ДАННЫХ...' },
  { at: 70, label: 'СТАБИЛИЗАЦИЯ...' },
  { at: 95, label: 'ВЫЧИСЛЕНИЕ...' },
]

type ScanPhase =
  | 'idle'
  | 'requesting'
  | 'loading'
  | 'scanning'    // face not yet detected
  | 'capturing'   // face detected, accumulating frames
  | 'done'
  | 'error'

// ─── Face Shape labels ────────────────────────────────────────────────────────
const SHAPE_LABELS: Record<FaceAnalysisResult['faceShape'], string> = {
  oval:    'Oval',
  diamond: 'Diamond',
  square:  'Square',
  heart:   'Heart',
  oblong:  'Oblong',
  round:   'Round',
}

// ─── Small pure components ────────────────────────────────────────────────────

function ProgressBar({ pct, className = 'bg-zinc-100' }: { pct: number; className?: string }) {
  return (
    <div className="h-[3px] w-full bg-zinc-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ease-out ${className}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  )
}

function TierBadge({ tier }: { tier: FaceTier }) {
  const meta = TIER_META[tier]
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-black tracking-widest uppercase ${meta.bgClass}`}>
      {meta.label}
    </span>
  )
}

function MetricRow({
  label, value, sub, accent = false,
}: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800/60 last:border-0">
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</p>
      <div className="text-right">
        <p className={`text-sm font-black font-mono ${accent ? 'text-emerald-400' : 'text-zinc-100'}`}>{value}</p>
        {sub && <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Result Card (full page) ──────────────────────────────────────────────────

function ResultCard({
  analysis, frameCount, onRescan,
}: {
  analysis: FaceAnalysisResult
  frameCount: number
  onRescan: () => void
}) {
  const tier = TIER_META[analysis.tier]
  const tierAboveAvg = ['htn', 'chad', 'adam'].includes(analysis.tier)

  return (
    <div className="px-4 py-6 space-y-4">

      {/* ── Hero Score Card ── */}
      <div className="relative rounded-3xl bg-zinc-900 border border-zinc-800 overflow-hidden p-6">
        {/* Subtle glow based on tier */}
        <div
          className="absolute inset-0 opacity-5"
          style={{ background: `radial-gradient(ellipse at center, ${tier.color} 0%, transparent 70%)` }}
        />

        <div className="relative z-10">
          {/* Tier badge + samples */}
          <div className="flex items-center justify-between mb-4">
            <TierBadge tier={analysis.tier} />
            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest font-mono">
              {frameCount} FRAMES AVG
            </p>
          </div>

          {/* Main score */}
          <div className="flex items-end gap-3 mb-1">
            <span
              className="text-[80px] font-black font-mono leading-none tracking-tighter"
              style={{ color: tier.color }}
            >
              {analysis.finalScore}
            </span>
            <span className="text-2xl font-bold text-zinc-600 mb-4">/100</span>
          </div>

          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-5">
            {tier.description}
          </p>

          {/* Score bar */}
          <ProgressBar
            pct={analysis.finalScore}
            className={tierAboveAvg ? 'bg-emerald-500' : 'bg-zinc-100'}
          />

          {/* Shape + tier row */}
          <div className="flex items-center gap-3 mt-4">
            <div className="flex-1 bg-zinc-800/60 rounded-xl px-3 py-2 text-center">
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest">ФОРМА ЛИЦА</p>
              <p className="text-sm font-black text-zinc-100 mt-0.5 uppercase tracking-widest">
                {SHAPE_LABELS[analysis.faceShape]}
              </p>
            </div>
            <div className="flex-1 bg-zinc-800/60 rounded-xl px-3 py-2 text-center">
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest">СИММЕТРИЯ</p>
              <p className="text-sm font-black text-zinc-100 font-mono mt-0.5">
                {analysis.symmetryScore}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Score Breakdown ── */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">ДЕТАЛЬНЫЙ АНАЛИЗ</p>
        </div>
        <div className="grid grid-cols-4 divide-x divide-zinc-800 border-b border-zinc-800">
          {[
            { label: 'SYM', value: analysis.symmetryScore },
            { label: 'CT',  value: analysis.canthalScore },
            { label: 'JAW', value: analysis.jawScore },
            { label: 'PROP', value: analysis.proportionScore },
          ].map(({ label, value }) => (
            <div key={label} className="py-4 text-center">
              <p className="text-[8px] text-zinc-500 uppercase tracking-widest">{label}</p>
              <p className="text-xl font-black text-zinc-100 font-mono mt-1">{value}</p>
            </div>
          ))}
        </div>
        <div className="px-5 py-1">
          <MetricRow
            label="FWHR (Ширина/Высота)"
            value={String(analysis.fwhr)}
            sub="ideal 1.7–2.0"
            accent={analysis.fwhr >= 1.7 && analysis.fwhr <= 2.0}
          />
          <MetricRow
            label="Canthal Tilt"
            value={`${analysis.canthalTilt.degrees > 0 ? '+' : ''}${analysis.canthalTilt.degrees}°`}
            sub={analysis.canthalTilt.status}
            accent={analysis.canthalTilt.status === 'Positive'}
          />
          <MetricRow
            label="Jawline Ratio"
            value={String(analysis.jawline.ratio)}
            sub={analysis.jawline.status}
            accent={analysis.jawline.status === 'Strong'}
          />
        </div>
      </div>

      {/* ── Facial Thirds ── */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">ПРОПОРЦИИ ТРЕТЕЙ</p>
        <div className="flex h-5 rounded-full overflow-hidden border border-zinc-700 font-mono text-[9px] font-black text-black">
          <div
            style={{ width: `${analysis.facialThirds.upper}%` }}
            className="bg-zinc-200 flex items-center justify-center"
          >
            {analysis.facialThirds.upper}%
          </div>
          <div
            style={{ width: `${analysis.facialThirds.middle}%` }}
            className="bg-zinc-500 flex items-center justify-center text-zinc-100"
          >
            {analysis.facialThirds.middle}%
          </div>
          <div
            style={{ width: `${analysis.facialThirds.lower}%` }}
            className="bg-zinc-700 flex items-center justify-center text-zinc-300"
          >
            {analysis.facialThirds.lower}%
          </div>
        </div>
        <div className="flex justify-between text-[8px] text-zinc-500 uppercase tracking-widest">
          <span>ЛОБ</span>
          <span>НОС</span>
          <span>ЧЕЛЮСТЬ</span>
        </div>
      </div>

      {/* ── Recommendations ── */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">РЕКОМЕНДАЦИИ</p>
        {analysis.canthalTilt.status === 'Negative' && (
          <div className="flex gap-3 items-start">
            <ChevronRight size={12} className="text-zinc-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-zinc-300">
              Негативный кантальный тилт. Мьюинг + укрепление скуловых мышц.
            </p>
          </div>
        )}
        {analysis.jawline.status === 'Narrow' && (
          <div className="flex gap-3 items-start">
            <ChevronRight size={12} className="text-zinc-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-zinc-300">
              Узкая челюсть. Мастикация, жевательная резинка Mastic Gum, мьюинг.
            </p>
          </div>
        )}
        {analysis.symmetryScore < 75 && (
          <div className="flex gap-3 items-start">
            <ChevronRight size={12} className="text-zinc-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-zinc-300">
              Асимметрия. Сон на спине, исправление осанки, чистка зубов по бокам равномерно.
            </p>
          </div>
        )}
        <div className="flex gap-3 items-start">
          <ChevronRight size={12} className="text-zinc-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-zinc-400">
            Скань раз в неделю для отслеживания прогресса мьюинга и looksmaxxing-протокола.
          </p>
        </div>
      </div>

      <button
        onClick={onRescan}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-100 font-bold text-sm tracking-widest uppercase hover:bg-zinc-800 transition-colors active:scale-[0.98]"
      >
        <RotateCcw size={16} strokeWidth={2.5} />
        ПЕРЕСКАНИРОВАТЬ
      </button>
    </div>
  )
}

// ─── Phase UI helpers ─────────────────────────────────────────────────────────

function CaptureLabel({ pct }: { pct: number }) {
  const phase = [...CAPTURE_PHASES].reverse().find(p => pct >= p.at)
  return (
    <p className="text-[10px] font-bold text-zinc-100 uppercase tracking-widest">
      {phase?.label ?? 'УДЕРЖИ ЛИЦО В РАМКЕ'}
    </p>
  )
}

// ─── Main Scanner Component ───────────────────────────────────────────────────

export function AdvancedFaceScanner() {
  const { haptic } = useTelegram()

  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef   = useRef<number | null>(null)
  const meshRef   = useRef<Awaited<ReturnType<typeof getFaceMesh>> | null>(null)

  // Frame buffer for averaging
  const framesRef = useRef<Landmark[][]>([])

  const [phase, setPhase]         = useState<ScanPhase>('idle')
  const [errorMsg, setErrorMsg]   = useState('')
  const [captureProgress, setCaptureProgress] = useState(0)  // 0–100
  const [analysis, setAnalysis]   = useState<FaceAnalysisResult | null>(null)
  const [frameCount, setFrameCount] = useState(0)
  const [meshVisible, setMeshVisible] = useState(false)

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    stopStream(streamRef.current)
    streamRef.current = null
    framesRef.current = []
    setMeshVisible(false)
    setCaptureProgress(0)
  }, [])

  // ── Draw canvas + overlay ─────────────────────────────────────────────────
  const onResults = useCallback((results: Results) => {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    const W = canvas.width, H = canvas.height

    // Mirror + desaturate
    ctx.save()
    ctx.scale(-1, 1)
    ctx.translate(-W, 0)
    ctx.filter = 'grayscale(70%) contrast(115%) brightness(85%)'
    ctx.drawImage(results.image, 0, 0, W, H)
    ctx.restore()

    const lm = results.multiFaceLandmarks?.[0]
    if (!lm) {
      setMeshVisible(false)
      return
    }

    setMeshVisible(true)
    const scanPhaseRef = framesRef.current

    // ── Accumulate frame ───────────────────────────────────────────────────
    if (scanPhaseRef.length < TARGET_FRAMES) {
      // Minimal cast — MediaPipe landmarks have x/y/z
      scanPhaseRef.push(lm as unknown as Landmark[])
      const pct = Math.round((scanPhaseRef.length / TARGET_FRAMES) * 100)
      setCaptureProgress(pct)
      setFrameCount(scanPhaseRef.length)

      if (scanPhaseRef.length === TARGET_FRAMES) {
        haptic.success()
        // Done capturing — compute result
        const avgLm = averageLandmarks(scanPhaseRef)
        try {
          const result = analyzeLandmarks(avgLm)
          setAnalysis(result)
          if (animRef.current) cancelAnimationFrame(animRef.current)
          stopStream(streamRef.current)
          streamRef.current = null
          setPhase('done')
        } catch (e) {
          console.error('[FaceScanner] Analysis failed:', e)
          setErrorMsg('Анализ не удался. Попробуй ещё раз.')
          setPhase('error')
        }
        return
      }
    }

    // ── Draw mesh overlay ─────────────────────────────────────────────────
    ctx.save()
    ctx.scale(-1, 1)
    ctx.translate(-W, 0)

    const capturingNow = scanPhaseRef.length > 0 && scanPhaseRef.length < TARGET_FRAMES

    // All 468 dots — brighter during capture
    ctx.fillStyle = capturingNow
      ? 'rgba(255, 255, 255, 0.55)'
      : 'rgba(255, 255, 255, 0.30)'
    for (const p of lm) {
      ctx.beginPath()
      ctx.arc(p.x * W, p.y * H, 1.3, 0, Math.PI * 2)
      ctx.fill()
    }

    // Key structural points — always solid white
    const KEY = [33, 263, 133, 362, 10, 4, 152, 127, 356, 234, 454, 61, 291, 172, 397]
    ctx.fillStyle = '#FFFFFF'
    for (const idx of KEY) {
      if (!lm[idx]) continue
      ctx.beginPath()
      ctx.arc(lm[idx].x * W, lm[idx].y * H, capturingNow ? 3.5 : 2.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Capture pulse ring around chin
    if (capturingNow) {
      const chin = lm[152]
      ctx.beginPath()
      ctx.arc(chin.x * W, chin.y * H, 6, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    ctx.restore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [haptic])

  // ── RAF loop ───────────────────────────────────────────────────────────────
  const processFrame = useCallback(async () => {
    const video = videoRef.current
    const mesh  = meshRef.current
    if (!video || !mesh || video.readyState < 2) {
      animRef.current = requestAnimationFrame(processFrame)
      return
    }
    await mesh.send({ image: video })
    animRef.current = requestAnimationFrame(processFrame)
  }, [])

  // ── Start scan ─────────────────────────────────────────────────────────────
  const startScan = useCallback(async () => {
    setPhase('requesting')
    setAnalysis(null)
    framesRef.current = []
    setCaptureProgress(0)
    setFrameCount(0)

    try {
      const stream = await navigator.mediaDevices.getUserMedia(getFrontCameraConstraints())
      streamRef.current = stream

      const video = videoRef.current!
      video.srcObject = stream
      await video.play()

      setPhase('loading')
      const mesh = await getFaceMesh(onResults)
      meshRef.current = mesh

      setPhase('scanning')
      animRef.current = requestAnimationFrame(processFrame)
    } catch (err) {
      const e = err as Error
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setErrorMsg('НЕТ ДОСТУПА К КАМЕРЕ. РАЗРЕШИТЕ В НАСТРОЙКАХ.')
      } else if (e.name === 'NotFoundError') {
        setErrorMsg('КАМЕРА НЕ НАЙДЕНА НА УСТРОЙСТВЕ.')
      } else {
        setErrorMsg(`ОШИБКА: ${e.message.slice(0, 60).toUpperCase()}`)
      }
      setPhase('error')
    }
  }, [onResults, processFrame])

  // ── Switch to 'capturing' when first face detected ─────────────────────────
  useEffect(() => {
    if (meshVisible && phase === 'scanning') {
      setPhase('capturing')
      haptic.medium()
    }
    if (!meshVisible && phase === 'capturing') {
      // Face lost during capture — reset buffer
      framesRef.current = []
      setCaptureProgress(0)
      setFrameCount(0)
      setPhase('scanning')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meshVisible, phase])

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => () => cleanup(), [cleanup])

  const handleRescan = useCallback(() => {
    cleanup()
    setPhase('idle')
    setAnalysis(null)
  }, [cleanup])

  // ── Result page ────────────────────────────────────────────────────────────
  if (phase === 'done' && analysis) {
    return <ResultCard analysis={analysis} frameCount={frameCount} onRescan={handleRescan} />
  }

  // ── Scanner viewport ───────────────────────────────────────────────────────
  const isActive = phase === 'scanning' || phase === 'capturing'

  return (
    <div className="px-4 py-6 space-y-4 max-w-lg mx-auto">

      {/* Camera viewport */}
      <div className="relative rounded-3xl overflow-hidden bg-zinc-950 aspect-[3/4] w-full border border-zinc-800">

        {/* Hidden video */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
          playsInline muted autoPlay
        />

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: (phase === 'idle' || phase === 'error') ? 'none' : 'block' }}
        />

        {/* Idle */}
        {phase === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-[2rem] bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Camera size={32} className="text-zinc-500" strokeWidth={1.5} />
            </div>
            <p className="text-[10px] font-bold text-zinc-500 text-center uppercase tracking-widest">
              ПРОДВИНУТЫЙ<br/>БИОМЕТРИЧЕСКИЙ АНАЛИЗ
            </p>
          </div>
        )}

        {/* Loading */}
        {phase === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-sm">
            <Loader2 size={36} className="text-zinc-100 animate-spin" />
            <p className="text-sm font-bold text-zinc-100 uppercase tracking-wide">ЗАГРУЗКА AI-МОДЕЛИ</p>
            <p className="text-[10px] text-zinc-500 font-mono">MODEL_SIZE: ~4MB</p>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 bg-zinc-950">
            <div className="w-16 h-16 rounded-full border-2 border-red-500/30 flex items-center justify-center">
              <AlertCircle size={28} className="text-red-500" />
            </div>
            <p className="text-[10px] font-bold text-zinc-400 text-center tracking-widest uppercase">{errorMsg}</p>
          </div>
        )}

        {/* Face oval guide */}
        {isActive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="rounded-[50%] border-2 transition-all duration-500"
              style={{
                width: '60%', height: '78%',
                borderColor: meshVisible ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)',
                borderStyle: meshVisible ? 'solid' : 'dashed',
                boxShadow: meshVisible ? '0 0 30px rgba(255,255,255,0.05) inset' : 'none',
              }}
            />
          </div>
        )}

        {/* Scanning: instruction */}
        {phase === 'scanning' && (
          <div className="absolute top-5 left-0 right-0 flex justify-center">
            <div className="px-4 py-2 rounded-xl bg-black/70 backdrop-blur-md border border-zinc-700/40">
              <p className="text-[10px] font-bold text-zinc-200 uppercase tracking-widest">
                СМОТРИ ПРЯМО В КАМЕРУ
              </p>
            </div>
          </div>
        )}

        {/* Capturing: progress bar */}
        {phase === 'capturing' && (
          <>
            {/* Top label */}
            <div className="absolute top-5 left-4 right-4 flex justify-center">
              <div className="px-4 py-2 rounded-xl bg-black/70 backdrop-blur-md border border-zinc-600/50 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-100 animate-pulse" />
                <CaptureLabel pct={captureProgress} />
              </div>
            </div>

            {/* Bottom progress */}
            <div className="absolute bottom-5 left-4 right-4 space-y-2">
              <div className="flex justify-between text-[9px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                <span>ЗАХВАТ КАДРОВ</span>
                <span>{frameCount}/{TARGET_FRAMES}</span>
              </div>
              <ProgressBar pct={captureProgress} className="bg-white" />
            </div>
          </>
        )}

        {/* LIVE badge */}
        {isActive && (
          <div className="absolute top-5 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-700/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-black text-zinc-100 uppercase tracking-widest">REC</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {phase === 'idle' && (
        <button
          onClick={startScan}
          className="w-full flex items-center justify-center gap-2 py-4 bg-zinc-100 text-black font-bold text-sm tracking-widest uppercase rounded-2xl transition-transform active:scale-95"
        >
          <Camera size={18} strokeWidth={2.5} />
          НАЧАТЬ СКАНИРОВАНИЕ
        </button>
      )}

      {phase === 'requesting' && (
        <div className="flex items-center justify-center gap-3 py-4">
          <Loader2 size={16} className="animate-spin text-zinc-400" />
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">ДОСТУП К КАМЕРЕ...</p>
        </div>
      )}

      {phase === 'error' && (
        <button
          onClick={handleRescan}
          className="w-full py-4 bg-zinc-900 border border-zinc-800 text-zinc-100 font-bold text-xs tracking-widest uppercase rounded-2xl active:scale-95"
        >
          ПОВТОРИТЬ
        </button>
      )}

      {isActive && (
        <button
          onClick={handleRescan}
          className="w-full py-4 text-zinc-600 hover:text-zinc-400 font-bold text-[10px] tracking-widest uppercase transition-colors"
        >
          ОТМЕНА
        </button>
      )}

      {/* Info block */}
      {phase === 'idle' && (
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">КАК РАБОТАЕТ</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Система собирает <strong className="text-zinc-200">{TARGET_FRAMES} кадров</strong> и усредняет
            координаты 468 точек лица, исключая влияние дрожания и шума. Затем вычисляются{' '}
            <strong className="text-zinc-200">FWHR, Canthal Tilt, симметрия</strong> и форма лица.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {(['adam', 'chad', 'htn', 'mtn', 'ltn', 'sub5', 'sub3'] as FaceTier[]).map(t => (
              <TierBadge key={t} tier={t} />
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">100% ЛОКАЛЬНО. ДАННЫЕ НЕ ПЕРЕДАЮТСЯ.</p>
          </div>
        </div>
      )}
    </div>
  )
}
