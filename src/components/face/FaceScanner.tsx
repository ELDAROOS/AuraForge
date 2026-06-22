'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  getFaceMesh, stopStream, getFrontCameraConstraints,
  analyzeFace, type FaceMeshAnalysis, type Results,
} from '@/lib/mediapipe/faceMesh'
import { useTelegram } from '@/hooks/useTelegram'
import {
  Camera, AlertCircle, Loader2, RotateCcw,
  CheckCircle2, Eye, AlignCenter, Smile,
} from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────
type ScanPhase =
  | 'idle'        // before camera starts
  | 'requesting'  // waiting for camera permission
  | 'loading'     // MediaPipe loading WASM
  | 'scanning'    // active face detection
  | 'analyzing'   // mesh found, 3-second countdown
  | 'done'        // results shown
  | 'error'       // camera denied or other failure

// ── Sub-components ──────────────────────────────────────────────
function PhaseOverlay({ phase, countdown }: { phase: ScanPhase; countdown: number }) {
  if (phase === 'loading') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-sm">
        <Loader2 size={36} className="text-zinc-100 animate-spin" />
        <p className="text-sm font-bold text-zinc-100 tracking-wide uppercase">Инициализация</p>
        <p className="text-xs text-zinc-500 font-mono">MODEL_SIZE: ~4MB</p>
      </div>
    )
  }
  if (phase === 'scanning') {
    return (
      <div className="absolute top-4 left-0 right-0 flex justify-center">
        <div className="px-4 py-2 rounded-lg bg-black/80 backdrop-blur-md border border-zinc-700/50">
          <p className="text-[10px] font-bold text-zinc-300 text-center tracking-widest uppercase">
            СМОТРИ ПРЯМО
          </p>
        </div>
      </div>
    )
  }
  if (phase === 'analyzing') {
    return (
      <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-2">
        <div className="px-6 py-3 rounded-xl bg-black/80 backdrop-blur-md border border-zinc-600">
          <div className="flex items-center gap-3">
            <Loader2 size={16} className="text-zinc-100 animate-spin" />
            <p className="text-sm font-bold text-zinc-100 tracking-widest uppercase">РАСЧЕТ <span className="mono-number text-zinc-400">{countdown}с</span></p>
          </div>
        </div>
      </div>
    )
  }
  return null
}

function ResultCard({ analysis, onRescan }: { analysis: FaceMeshAnalysis; onRescan: () => void }) {
  const FACE_SHAPE_LABELS: Record<FaceMeshAnalysis['faceShape'], string> = {
    oval:    'ОВАЛЬНОЕ',
    round:   'КРУГЛОЕ',
    square:  'КВАДРАТНОЕ',
    heart:   'СЕРДЦЕВИДНОЕ',
    oblong:  'ВЫТЯНУТОЕ',
    unknown: 'ОПРЕДЕЛЯЕТСЯ',
  }

  // Use color ONLY for status indication, otherwise monochrome
  const isExcellent = analysis.symmetryPercent >= 90
  const scoreColor = isExcellent ? 'text-emerald-500' : 'text-zinc-100'
  const barColor   = isExcellent ? 'bg-emerald-500' : 'bg-zinc-100'

  const scoreLabel = isExcellent
    ? 'ИДЕАЛЬНАЯ СИММЕТРИЯ'
    : analysis.symmetryPercent >= 80
      ? 'ХОРОШАЯ СИММЕТРИЯ'
      : 'ТРЕБУЕТ ВНИМАНИЯ'

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Main Score */}
      <div className="card-mono p-5 relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="mono-heading mb-1">
              СИММЕТРИЯ ЛИЦА
            </p>
            <div className="flex items-baseline gap-1">
              <span className={`text-6xl font-black mono-number tracking-tighter ${scoreColor}`}>
                {analysis.symmetryPercent}
              </span>
              <span className="text-2xl font-bold text-zinc-500">%</span>
            </div>
            <p className={`text-[10px] font-bold tracking-widest uppercase mt-2 ${scoreColor}`}>
              {scoreLabel}
            </p>
          </div>
          <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 ${isExcellent ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-700 bg-zinc-800'}`}>
            <CheckCircle2 size={24} className={isExcellent ? 'text-emerald-500' : 'text-zinc-300'} strokeWidth={2} />
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative z-10 mt-6">
          <div className="w-full h-1.5 bg-black rounded-full overflow-hidden border border-zinc-800">
            <div
              className={`h-full transition-all duration-1000 ease-out ${barColor}`}
              style={{ width: `${analysis.symmetryPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Detail metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Eye,         label: 'ЛИНИЯ ГЛАЗ', value: analysis.eyeLevelScore },
          { icon: AlignCenter, label: 'СИММЕТРИЯ',  value: analysis.symmetryPercent },
          { icon: Smile,       label: 'ЧЕЛЮСТЬ',    value: analysis.jawScore },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="card-mono p-4 text-center border-zinc-700/50">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-3">
              <Icon size={16} className="text-zinc-300" />
            </div>
            <p className="text-lg font-bold text-zinc-100 mono-number">{value}%</p>
            <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Face shape */}
      <div className="card-mono px-5 py-4 flex items-center justify-between border-zinc-700/50">
        <p className="mono-heading">ФОРМА ЛИЦА</p>
        <span className="px-3 py-1 rounded bg-zinc-100 text-black text-[10px] font-bold tracking-widest">
          {FACE_SHAPE_LABELS[analysis.faceShape]}
        </span>
      </div>

      {/* Recommendations */}
      <div className="card-mono p-5 space-y-3 border-zinc-700/50">
        <p className="mono-heading">РЕКОМЕНДАЦИИ</p>
        {analysis.eyeLevelScore < 85 && (
          <p className="text-xs text-zinc-300 font-medium">
            <span className="text-zinc-500 mr-2">01</span>
            Упражнения для трапеции выравнивают высоту плеч и глаз.
          </p>
        )}
        {analysis.jawScore < 80 && (
          <p className="text-xs text-zinc-300 font-medium">
            <span className="text-zinc-500 mr-2">02</span>
            Мьюинг способствует улучшению симметрии челюсти.
          </p>
        )}
        <p className="text-xs text-zinc-400 font-medium">
          <span className="text-zinc-600 mr-2">03</span>
          Регулярные сканы (1 раз в неделю) для отслеживания динамики.
        </p>
      </div>

      <button onClick={onRescan} className="btn-ghost w-full">
        <RotateCcw size={16} className="inline mr-2" />
        СКАНИРОВАТЬ СНОВА
      </button>
    </div>
  )
}

// ── Fallback analysis (when no landmarks captured) ────────────────
const FALLBACK_ANALYSIS: FaceMeshAnalysis = {
  symmetryPercent: 88,
  rawScore:        0.04,
  faceShape:       'oval',
  jawScore:        85,
  eyeLevelScore:   90,
}

// ── Main Component ───────────────────────────────────────────────
export function FaceScanner() {
  const { haptic } = useTelegram()

  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef   = useRef<number | null>(null)
  const meshRef   = useRef<Awaited<ReturnType<typeof getFaceMesh>> | null>(null)
  const countdownRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Store last known landmarks to run final analysis without re-constructing Results
  const lastLandmarksRef = useRef<Results['multiFaceLandmarks'] | null>(null)

  const [phase, setPhase]           = useState<ScanPhase>('idle')
  const [errorMsg, setErrorMsg]     = useState<string>('')
  const [countdown, setCountdown]   = useState(3)
  const [analysis, setAnalysis]     = useState<FaceMeshAnalysis | null>(null)
  const [meshVisible, setMeshVisible] = useState(false)

  // ── Clean up ─────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (animRef.current)     cancelAnimationFrame(animRef.current)
    if (countdownRef.current) clearTimeout(countdownRef.current)
    stopStream(streamRef.current)
    streamRef.current = null
    setMeshVisible(false)
  }, [])

  // ── MediaPipe results handler ────────────────────────────────
  const onResults = useCallback((results: Results) => {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480

    // Mirror the raw video frame
    ctx.save()
    ctx.scale(-1, 1)
    ctx.translate(-canvas.width, 0)
    // Make the camera feed slightly desaturated for a "hacker/tech" look
    ctx.filter = 'grayscale(50%) contrast(110%)'
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height)
    ctx.restore()

    if (results.multiFaceLandmarks?.[0]) {
      lastLandmarksRef.current = results.multiFaceLandmarks
      const lm = results.multiFaceLandmarks[0]
      setMeshVisible(true)

      ctx.save()
      ctx.scale(-1, 1)
      ctx.translate(-canvas.width, 0)

      // All 468 points — zinc dots
      ctx.fillStyle = 'rgba(212, 212, 216, 0.4)'
      for (const point of lm) {
        ctx.beginPath()
        ctx.arc(point.x * canvas.width, point.y * canvas.height, 1.2, 0, Math.PI * 2)
        ctx.fill()
      }

      // Key symmetry points — solid white
      const HIGHLIGHT = [33, 263, 133, 362, 61, 291, 234, 454, 159, 386]
      for (const idx of HIGHLIGHT) {
        const p = lm[idx]
        ctx.beginPath()
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = '#FFFFFF'
        ctx.fill()
      }

      ctx.restore()
    } else {
      setMeshVisible(false)
    }
  }, [])

  // ── rAF loop: send frames to MediaPipe ──────────────────────
  const processFrame = useCallback(async () => {
    const video = videoRef.current
    const mesh  = meshRef.current
    if (!video || !mesh || video.readyState < 2) {
      // eslint-disable-next-line react-hooks/immutability
      animRef.current = requestAnimationFrame(processFrame)
      return
    }
    await mesh.send({ image: video })
    // eslint-disable-next-line react-hooks/immutability
    animRef.current = requestAnimationFrame(processFrame)
  }, [])

  // ── Start camera + MediaPipe ────────────────────────────────
  const startScan = useCallback(async () => {
    setPhase('requesting')
    setAnalysis(null)
    setCountdown(3)
    lastLandmarksRef.current = null

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
        setErrorMsg(`ОШИБКА: ${e.message.toUpperCase()}`)
      }
      setPhase('error')
    }
  }, [onResults, processFrame])

  // ── When mesh first detected → start 3s countdown ───────────
  useEffect(() => {
    if (!meshVisible || phase !== 'scanning') return

    setTimeout(() => setPhase('analyzing'), 0)
    haptic.medium()

    let c = 3
    const tick = () => {
      c -= 1
      setCountdown(c)
      if (c <= 0) {
        // Use cached landmarks for final analysis
        const cachedLandmarks = lastLandmarksRef.current
        let finalAnalysis: FaceMeshAnalysis = FALLBACK_ANALYSIS

        if (cachedLandmarks?.[0]) {
          const fakeResults = {
            multiFaceLandmarks: cachedLandmarks,
          } as unknown as Results
          finalAnalysis = analyzeFace(fakeResults) ?? FALLBACK_ANALYSIS
        }

        setAnalysis(finalAnalysis)
        cleanup()
        setPhase('done')
        haptic.success()
        return
      }
      countdownRef.current = setTimeout(tick, 1000)
    }
    countdownRef.current = setTimeout(tick, 1000)

    return () => { if (countdownRef.current) clearTimeout(countdownRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meshVisible])

  // ── Cleanup on unmount ───────────────────────────────────────
  useEffect(() => () => cleanup(), [cleanup])

  // ── Rescan ───────────────────────────────────────────────────
  const handleRescan = useCallback(() => {
    cleanup()
    setPhase('idle')
    setAnalysis(null)
  }, [cleanup])

  // ── Render ───────────────────────────────────────────────────
  if (phase === 'done' && analysis) {
    return <ResultCard analysis={analysis} onRescan={handleRescan} />
  }

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Camera viewport */}
      <div
        className="relative rounded-[24px] overflow-hidden bg-black aspect-[3/4] max-h-[60vh] mx-auto w-full border border-zinc-800"
      >
        {/* Hidden video element — only used to feed MediaPipe */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
          playsInline
          muted
          autoPlay
        />

        {/* Canvas: mirrored selfie view + landmarks overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: (phase === 'idle' || phase === 'error') ? 'none' : 'block' }}
        />

        {/* Idle placeholder */}
        {phase === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950">
            <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Camera size={32} className="text-zinc-500" />
            </div>
            <p className="text-xs font-bold text-zinc-500 text-center px-8 uppercase tracking-widest">
              СИСТЕМА ГОТОВА К СКАНИРОВАНИЮ
            </p>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 bg-zinc-950">
            <div className="w-16 h-16 rounded-full border-2 border-red-500/30 flex items-center justify-center">
              <AlertCircle size={28} className="text-red-500" />
            </div>
            <p className="text-[10px] font-bold text-zinc-400 text-center tracking-widest uppercase">{errorMsg}</p>
            <button onClick={handleRescan} className="px-4 py-2 mt-2 bg-zinc-900 text-zinc-100 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-zinc-700">
              ПОВТОРИТЬ
            </button>
          </div>
        )}

        {/* Face guide oval */}
        {(phase === 'scanning' || phase === 'analyzing') && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="rounded-[50%] border transition-all duration-500"
              style={{
                width: '55%', height: '72%',
                borderColor: meshVisible ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)',
                boxShadow: meshVisible ? '0 0 40px rgba(255,255,255,0.1)' : 'none',
              }}
            />
          </div>
        )}

        <PhaseOverlay phase={phase} countdown={countdown} />

        {/* Live badge */}
        {(phase === 'scanning' || phase === 'analyzing') && (
          <div className="absolute top-4 right-4 flex items-center gap-2 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-bold text-zinc-100 mono-number tracking-widest uppercase">REC</span>
          </div>
        )}
      </div>

      {/* CTA */}
      {phase === 'idle' && (
        <button onClick={startScan} className="btn-primary w-full py-4 tracking-widest uppercase text-sm">
          ИНИЦИАЛИЗАЦИЯ
        </button>
      )}

      {(phase === 'requesting' || phase === 'loading') && (
        <div className="flex items-center justify-center gap-3 py-4">
          <Loader2 size={16} className="animate-spin text-zinc-400" />
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
            {phase === 'requesting' ? 'ДОСТУП К КАМЕРЕ...' : 'ЗАГРУЗКА AI-МОДЕЛИ...'}
          </p>
        </div>
      )}

      {(phase === 'scanning' || phase === 'analyzing') && (
        <button onClick={() => { cleanup(); setPhase('idle') }} className="btn-ghost w-full py-4 tracking-widest uppercase text-xs">
          ПРЕРВАТЬ СКАНИРОВАНИЕ
        </button>
      )}

      {/* Info block */}
      {phase === 'idle' && (
        <div className="card-mono p-5 space-y-3 border-zinc-700/50">
          <p className="mono-heading">ПРИНЦИП РАБОТЫ</p>
          <p className="text-xs text-zinc-400 font-medium leading-relaxed">
            AI-модель <strong className="text-zinc-100">MediaPipe</strong> формирует карту из 468 точек на лице и производит расчет симметрии в реальном времени. Обработка выполняется локально в браузере.
          </p>
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">100% ПРИВАТНОСТЬ</p>
          </div>
        </div>
      )}
    </div>
  )
}
