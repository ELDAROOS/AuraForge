'use client'

import { useEffect, useState, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X, Loader2, Maximize } from 'lucide-react'

export function BarcodeScanner({
  onScan,
  onClose
}: {
  onScan: (barcode: string) => void
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    // We need to wait slightly for the DOM element to be ready
    const scannerId = "reader"
    let isUnmounted = false

    const initScanner = async () => {
      try {
        const hasCamera = await Html5Qrcode.getCameras()
        if (isUnmounted) return
        
        if (hasCamera && hasCamera.length > 0) {
          const html5QrCode = new Html5Qrcode(scannerId)
          scannerRef.current = html5QrCode

          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 150 },
              aspectRatio: 1.0,
            },
            (decodedText) => {
              // Success callback
              html5QrCode.stop().then(() => {
                if (!isUnmounted) onScan(decodedText)
              }).catch(err => {
                console.error("Failed to stop scanner", err)
                if (!isUnmounted) onScan(decodedText)
              })
            },
            (errorMessage) => {
              // Parse error - we ignore these as they happen continuously until a barcode is found
            }
          )
        } else {
          setError('Камера не найдена на устройстве')
        }
      } catch (err) {
        console.error("Scanner init error", err)
        if (!isUnmounted) setError('Ошибка доступа к камере. Разрешите доступ в браузере.')
      } finally {
        if (!isUnmounted) setIsInitializing(false)
      }
    }

    // Give a small delay for modal animation to settle
    setTimeout(() => {
      if (!isUnmounted) initScanner()
    }, 300)

    return () => {
      isUnmounted = true
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error)
      }
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 pt-safe z-10 bg-gradient-to-b from-black/80 to-transparent">
        <p className="text-sm font-bold text-zinc-100 uppercase tracking-widest flex items-center gap-2">
          <Maximize size={16} /> СКАНИРОВАНИЕ
        </p>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-zinc-800/80 backdrop-blur-md flex items-center justify-center text-zinc-100 transition-transform active:scale-90"
        >
          <X size={20} />
        </button>
      </div>

      {/* Viewport */}
      <div className="flex-1 relative flex items-center justify-center">
        {isInitializing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-3">
            <Loader2 size={32} className="animate-spin text-zinc-400" />
            <p className="text-xs uppercase tracking-widest">Запуск камеры...</p>
          </div>
        )}
        
        {error ? (
          <div className="px-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <X size={32} className="text-red-500" />
            </div>
            <p className="text-sm font-bold text-zinc-100 mb-2">Не удалось открыть камеру</p>
            <p className="text-xs text-zinc-500">{error}</p>
          </div>
        ) : (
          <div id="reader" className="w-full h-full max-h-[80vh] overflow-hidden" />
        )}

        {/* Overlay guides (if scanner is running) */}
        {!isInitializing && !error && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between pb-20">
            <div className="flex-1 bg-black/40" />
            <div className="flex">
              <div className="w-full bg-black/40" />
              {/* Scan target area - transparent hole */}
              <div className="w-[250px] h-[150px] flex-shrink-0 border-2 border-emerald-500/50 relative">
                {/* Corner markers */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-500" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-500" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-500" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-500" />
                {/* Scanning line animation */}
                <div className="w-full h-0.5 bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.8)] absolute left-0 animate-[scan_2s_ease-in-out_infinite]" />
              </div>
              <div className="w-full bg-black/40" />
            </div>
            <div className="flex-1 bg-black/40 flex items-center justify-center pt-8">
               <p className="text-xs text-zinc-100 bg-black/60 px-4 py-2 rounded-full backdrop-blur-md">
                 Наведите на штрихкод упаковки
               </p>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        /* Hide html5-qrcode default UI elements since we want a custom look */
        #reader img, #reader video { object-fit: cover !important; }
        #reader__dashboard_section_csr span { display: none !important; }
        #reader__dashboard_section_swaplink { display: none !important; }
        #reader__scan_region { min-height: 100%; }
        
        @keyframes scan {
          0%, 100% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          50% { top: 100%; opacity: 1; }
          90% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
