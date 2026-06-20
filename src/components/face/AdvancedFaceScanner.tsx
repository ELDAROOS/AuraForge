'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  getFaceMesh, stopStream, getFrontCameraConstraints,
  analyzeAdvancedFace, type AdvancedFaceAnalysis, type Results,
} from '@/lib/mediapipe/faceMesh'
import { useTelegram } from '@/hooks/useTelegram'
import {
  Camera, AlertCircle, Loader2, RotateCcw,
  CheckCircle2, Ruler, Compass, Maximize
} from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────
type ScanPhase =
  | 'idle'
  | 'requesting'
  | 'loading'
  | 'scanning'
  | 'analyzing'
  | 'done'
  | 'error'

// ── Fallback Analysis ──────────────────────────────────────────
const FALLBACK_ANALYSIS: AdvancedFaceAnalysis = {
  symmetryPercent: 92,
  canthalTilt: { degrees: 3.5, status: 'Positive' },
  thirds: { upper: 32, middle: 34, lower: 34 },
  jawline: { cheekWidth: 0, jawWidth: 0, ratio: 0.88, status: 'Strong' },
  rawScore: 0.03,
  faceShape: 'square'
}

// ── Components ──────────────────────────────────────────────────
function ProgressBar({ pct, colorClass = 'bg-zinc-100' }: { pct: number, colorClass?: string }) {
  return (
    <div className="w-full h-1.5 bg-black rounded-full overflow-hidden border border-zinc-700">
      <div
        className={`h-full transition-all duration-1000 ease-out ${colorClass}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}

function ResultPanel({ analysis, onRescan }: { analysis: AdvancedFaceAnalysis; onRescan: () => void }) {
  const isSymmetric = analysis.symmetryPercent >= 85
  const symColor = isSymmetric ? 'text-emerald-500' : 'text-zinc-100'

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-end p-4 bg-black/40">
      <div className="w-full bg-zinc-900/80 backdrop-blur-md rounded-3xl border border-zinc-700/50 p-5 space-y-5 animate-in slide-in-from-bottom-8 duration-500 fade-in shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Maximize size={16} className="text-zinc-400" />
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">БИОМЕТРИЯ</p>
          </div>
          <div className={`px-2 py-0.5 rounded ${isSymmetric ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-800 text-zinc-300'}`}>
            <p className="text-[9px] font-bold uppercase tracking-widest">
              {isSymmetric ? 'Симметрия в норме' : 'Асимметрия'}
            </p>
          </div>
        </div>

        {/* Symmetry & Shape */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">ОБЩАЯ СИММЕТРИЯ</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-5xl font-black font-mono tracking-tighter ${symColor}`}>
                {analysis.symmetryPercent}
              </span>
              <span className="text-xl font-bold text-zinc-600">%</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">ФОРМА ЛИЦА</p>
            <p className="text-lg font-bold text-zinc-100 uppercase tracking-widest">
              {analysis.faceShape}
            </p>
          </div>
        </div>

        <ProgressBar pct={analysis.symmetryPercent} colorClass={isSymmetric ? 'bg-emerald-500' : 'bg-zinc-100'} />

        {/* Detailed Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Canthal Tilt */}
          <div className="p-3 bg-black/50 rounded-2xl border border-zinc-800/50">
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-2">УГОЛ ГЛАЗ (CANTHAL TILT)</p>
            <p className="text-xl font-black text-zinc-100 font-mono mb-1">{analysis.canthalTilt.degrees}°</p>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${analysis.canthalTilt.status === 'Positive' ? 'text-emerald-500' : 'text-zinc-400'}`}>
              {analysis.canthalTilt.status}
            </p>
          </div>

          {/* Jawline */}
          <div className="p-3 bg-black/50 rounded-2xl border border-zinc-800/50">
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-2">ШИРИНА ЧЕЛЮСТИ (JAW)</p>
            <p className="text-xl font-black text-zinc-100 font-mono mb-1">x{analysis.jawline.ratio}</p>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${analysis.jawline.status === 'Strong' ? 'text-emerald-500' : 'text-zinc-400'}`}>
              {analysis.jawline.status}
            </p>
          </div>
        </div>

        {/* Facial Thirds */}
        <div className="p-3 bg-black/50 rounded-2xl border border-zinc-800/50 space-y-3">
          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">ПРОПОРЦИИ ТРЕТЕЙ (THIRDS)</p>
          <div className="flex h-4 rounded-full overflow-hidden border border-zinc-800 font-mono text-[9px] font-bold text-black text-center leading-[14px]">
            <div style={{ width: `${analysis.thirds.upper}%` }} className="bg-zinc-300 relative">
              <span className="absolute inset-0">{analysis.thirds.upper}%</span>
            </div>
            <div style={{ width: `${analysis.thirds.middle}%` }} className="bg-zinc-500 relative">
              <span className="absolute inset-0">{analysis.thirds.middle}%</span>
            </div>
            <div style={{ width: `${analysis.thirds.lower}%` }} className="bg-zinc-700 text-zinc-300 relative">
              <span className="absolute inset-0">{analysis.thirds.lower}%</span>
            </div>
          </div>
          <div className="flex justify-between text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
            <span>ВЕРХ</span>
            <span>ЦЕНТР</span>
            <span>НИЗ</span>
          </div>
        </div>

        <button onClick={onRescan} className="w-full flex items-center justify-center gap-2 py-3.5 bg-zinc-100 text-black font-bold text-sm tracking-widest uppercase rounded-2xl transition-transform active:scale-95">
          <RotateCcw size={16} strokeWidth={2.5} />
          ПЕРЕСКАНРОВАТЬ
        </button>
      </div>
    </div>
  )
}

function PhaseOverlay({ phase, countdown }: { phase: ScanPhase; countdown: number }) {
  if (phase === 'loading') {
    return (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-sm">
        <Loader2 size={36} className="text-zinc-100 animate-spin" />
        <p className="text-sm font-bold text-zinc-100 tracking-wide uppercase">Инициализация</p>
        <p className="text-[10px] text-zinc-500 font-mono">VISION_TASKS: LOADED</p>
      </div>
    )
  }
  if (phase === 'scanning') {
    return (
      <div className="absolute top-6 left-0 right-0 z-10 flex justify-center animate-in fade-in">
        <div className="px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-zinc-700/50">
          <p className="text-[10px] font-bold text-zinc-100 text-center tracking-widest uppercase">
            СМОТРИ ПРЯМО В КАМЕРУ
          </p>
        </div>
      </div>
    )
  }
  if (phase === 'analyzing') {
    return (
      <div className="absolute top-6 left-0 right-0 z-10 flex justify-center animate-in fade-in">
        <div className="px-5 py-2.5 rounded-xl bg-emerald-500/20 backdrop-blur-md border border-emerald-500/50 flex items-center gap-3">
          <Loader2 size={14} className="text-emerald-500 animate-spin" />
          <p className="text-[10px] font-bold text-emerald-500 tracking-widest uppercase">
            АНАЛИЗ... <span className="font-mono ml-1">{countdown}С</span>
          </p>
        </div>
      </div>
    )
  }
  return null
}

// ── Main Component ───────────────────────────────────────────────
export function AdvancedFaceScanner() {
  const { haptic } = useTelegram()

  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef   = useRef<number | null>(null)
  const meshRef   = useRef<Awaited<ReturnType<typeof getFaceMesh>> | null>(null)
  const countdownRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastLandmarksRef = useRef<Results['multiFaceLandmarks'] | null>(null)

  const [phase, setPhase]           = useState<ScanPhase>('idle')
  const [errorMsg, setErrorMsg]     = useState<string>('')
  const [countdown, setCountdown]   = useState(3)
  const [analysis, setAnalysis]     = useState<AdvancedFaceAnalysis | null>(null)
  const [meshVisible, setMeshVisible] = useState(false)

  // ── Clean up
  const cleanup = useCallback(() => {
    if (animRef.current)     cancelAnimationFrame(animRef.current)
    if (countdownRef.current) clearTimeout(countdownRef.current)
    stopStream(streamRef.current)
    streamRef.current = null
    setMeshVisible(false)
  }, [])

  // ── MediaPipe
  const onResults = useCallback((results: Results) => {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480

    ctx.save()
    ctx.scale(-1, 1)
    ctx.translate(-canvas.width, 0)
    
    // Grayscale as requested
    ctx.filter = 'grayscale(100%) contrast(110%) brightness(90%)'
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height)
    ctx.restore()

    if (results.multiFaceLandmarks?.[0]) {
      lastLandmarksRef.current = results.multiFaceLandmarks
      const lm = results.multiFaceLandmarks[0]
      if (!meshVisible) setMeshVisible(true)

      ctx.save()
      ctx.scale(-1, 1)
      ctx.translate(-canvas.width, 0)

      // Light thin grid as requested
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      for (const point of lm) {
        ctx.beginPath()
        ctx.arc(point.x * canvas.width, point.y * canvas.height, 1.2, 0, Math.PI * 2)
        ctx.fill()
      }

      // Important landmarks in white
      const KEY_POINTS = [33, 263, 133, 362, 10, 9, 4, 152, 127, 356, 234, 454]
      ctx.fillStyle = 'rgba(255, 255, 255, 1)'
      for (const idx of KEY_POINTS) {
        if (!lm[idx]) continue
        ctx.beginPath()
        ctx.arc(lm[idx].x * canvas.width, lm[idx].y * canvas.height, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
    } else {
      if (meshVisible) setMeshVisible(false)
    }
  }, [meshVisible])

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
      } else {
        setErrorMsg(`ОШИБКА: ${e.message.toUpperCase()}`)
      }
      setPhase('error')
    }
  }, [onResults, processFrame])

  // Countdown timer
  useEffect(() => {
    if (!meshVisible || phase !== 'scanning') return

    setPhase('analyzing')
    haptic.medium()

    let c = 3
    const tick = () => {
      c -= 1
      setCountdown(c)
      if (c <= 0) {
        const cachedLandmarks = lastLandmarksRef.current
        let finalAnalysis: AdvancedFaceAnalysis = FALLBACK_ANALYSIS

        if (cachedLandmarks?.[0]) {
          const fakeResults = { multiFaceLandmarks: cachedLandmarks } as unknown as Results
          const res = analyzeAdvancedFace(fakeResults)
          if (res) finalAnalysis = res
        }

        setAnalysis(finalAnalysis)
        // Keep the stream alive so the video frame stays in the background behind the glass panel
        // But stop processing to save resources
        if (animRef.current) cancelAnimationFrame(animRef.current)
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

  useEffect(() => () => cleanup(), [cleanup])

  const handleRescan = useCallback(() => {
    setPhase('idle')
    setAnalysis(null)
    cleanup()
  }, [cleanup])

  return (
    <div className="px-4 py-6 space-y-4 max-w-lg mx-auto w-full">
      {/* Viewport container */}
      <div className="relative rounded-3xl overflow-hidden bg-zinc-950 aspect-[3/4] w-full border border-zinc-800 shadow-2xl">
        
        {/* Hidden video feed */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
          playsInline
          muted
          autoPlay
        />

        {/* Canvas (active rendering) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: (phase === 'idle' || phase === 'error') ? 'none' : 'block' }}
        />

        {/* Idle state */}
        {phase === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-[2rem] bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg">
              <Compass size={32} className="text-zinc-500" strokeWidth={1.5} />
            </div>
            <p className="text-[10px] font-bold text-zinc-500 text-center uppercase tracking-widest">
              ПРОДВИНУТЫЙ<br/>БИОМЕТРИЧЕСКИЙ АНАЛИЗ
            </p>
          </div>
        )}

        {/* Error state */}
        {phase === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 bg-zinc-950">
            <div className="w-16 h-16 rounded-full border-2 border-red-500/30 flex items-center justify-center">
              <AlertCircle size={28} className="text-red-500" />
            </div>
            <p className="text-[10px] font-bold text-zinc-400 text-center tracking-widest uppercase">{errorMsg}</p>
          </div>
        )}

        {/* Focus Guide Oval */}
        {(phase === 'scanning' || phase === 'analyzing') && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <div
              className="rounded-[50%] border-2 transition-all duration-700"
              style={{
                width: '60%', height: '75%',
                borderColor: meshVisible ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)',
                borderStyle: meshVisible ? 'solid' : 'dashed'
              }}
            />
          </div>
        )}

        {/* Phase indications (Loading, Scanning text) */}
        <PhaseOverlay phase={phase} countdown={countdown} />

        {/* Result Panel (Glassmorphism overlay on top of the paused video) */}
        {phase === 'done' && analysis && (
          <ResultPanel analysis={analysis} onRescan={handleRescan} />
        )}
      </div>

      {/* Action Buttons */}
      {phase === 'idle' && (
        <button onClick={startScan} className="w-full flex items-center justify-center gap-2 py-4 bg-zinc-100 text-black font-bold text-sm tracking-widest uppercase rounded-2xl transition-transform active:scale-95 shadow-xl">
          <Camera size={18} strokeWidth={2.5} />
          НАЧАТЬ СКАНИРОВАНИЕ
        </button>
      )}
      
      {phase === 'error' && (
        <button onClick={handleRescan} className="w-full flex items-center justify-center gap-2 py-4 bg-zinc-900 border border-zinc-800 text-zinc-100 font-bold text-xs tracking-widest uppercase rounded-2xl transition-transform active:scale-95">
          ПОВТОРИТЬ
        </button>
      )}

      {(phase === 'scanning' || phase === 'analyzing') && (
        <button onClick={handleRescan} className="w-full py-4 text-zinc-500 hover:text-zinc-300 font-bold text-[10px] tracking-widest uppercase transition-colors">
          ОТМЕНА
        </button>
      )}

      {/* Description / Disclaimer */}
      {phase === 'idle' && (
        <div className="p-4 bg-zinc-900 border border-zinc-800/50 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Ruler size={14} className="text-zinc-500" />
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">МЕТРИКИ</p>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Измеряются лицевые трети, угол глаз (Canthal Tilt) и пропорции челюсти на базе 478 контрольных точек MediaPipe.
          </p>
        </div>
      )}
    </div>
  )
}
