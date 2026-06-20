// ============================================================
// AuraForge — MediaPipe Face Mesh Singleton Wrapper
// Browser-only: always import dynamically or inside useEffect
// ============================================================

import type { Results, FaceMesh as FaceMeshType } from '@mediapipe/face_mesh'

export type { Results }

// ── Landmark pair indices for symmetry analysis ──────────────
// MediaPipe Face Mesh has 468 landmarks (0-indexed).
// We compare left ↔ right mirrored pairs.
const SYMMETRY_PAIRS: [number, number][] = [
  [33,  263],  // inner eye corners
  [133, 362],  // outer eye corners
  [159, 386],  // upper eyelids
  [145, 374],  // lower eyelids
  [70,  300],  // eyebrows inner
  [107, 336],  // eyebrows arch
  [61,  291],  // mouth corners
  [40,  270],  // upper lip
  [0,   0],    // nose tip (midline – skipped in calc)
  [234, 454],  // jaw left / right
  [127, 356],  // cheeks
  [58,  288],  // lower cheeks
]

export interface AdvancedFaceAnalysis {
  symmetryPercent: number

  canthalTilt: {
    degrees: number
    status: 'Positive' | 'Neutral' | 'Negative'
  }

  thirds: {
    upper: number // %
    middle: number // %
    lower: number // %
  }

  jawline: {
    cheekWidth: number
    jawWidth: number
    ratio: number // jaw / cheek
    status: 'Strong' | 'Average' | 'Narrow'
  }

  rawScore: number
  faceShape: 'oval' | 'round' | 'square' | 'heart' | 'oblong' | 'unknown'
}

/**
 * Calculates advanced facial biometrics from MediaPipe landmarks.
 */
export function analyzeAdvancedFace(results: Results): AdvancedFaceAnalysis | null {
  if (!results.multiFaceLandmarks?.[0]) return null
  const lm = results.multiFaceLandmarks[0]

  // ── Bounding box for normalisation ──────────────────────
  let minY = Infinity, maxY = -Infinity
  let minX = Infinity, maxX = -Infinity
  for (const p of lm) {
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
  }
  const faceH = maxY - minY || 1
  const faceW = maxX - minX || 1
  const midX  = (minX + maxX) / 2

  // ── 1. General Symmetry ──────────────────────────────────
  const diffs: number[] = []
  for (const [l, r] of SYMMETRY_PAIRS) {
    if (l === r) continue
    const dLeft  = Math.abs(lm[l].x - midX) / faceW
    const dRight = Math.abs(lm[r].x - midX) / faceW
    const yDiff  = Math.abs(lm[l].y - lm[r].y) / faceH
    diffs.push(Math.abs(dLeft - dRight) + yDiff)
  }
  const rawScore = diffs.reduce((a, b) => a + b, 0) / diffs.length
  
  // Basic eye and jaw levelness
  const eyeDY = Math.abs(lm[33].y - lm[263].y) / faceH
  const jawDY = Math.abs(lm[234].y - lm[454].y) / faceH
  const levelScore = Math.max(0, 1 - (eyeDY * 5 + jawDY * 5))
  
  const symmetryRaw = 1 - Math.min(rawScore * 10, 1)
  const symmetryPercent = Math.round((symmetryRaw * 0.7 + levelScore * 0.3) * 100)

  // ── 2. Canthal Tilt ──────────────────────────────────────
  // Left eye: inner 33, outer 133. Right eye: inner 263, outer 362.
  // Y increases downwards. Positive tilt = outer is HIGHER (y is SMALLER)
  const calcTilt = (inner: any, outer: any) => {
    const dy = inner.y - outer.y // positive if outer is higher
    const dx = Math.abs(outer.x - inner.x)
    return Math.atan2(dy, dx) * (180 / Math.PI)
  }
  const leftTilt = calcTilt(lm[33], lm[133])
  const rightTilt = calcTilt(lm[263], lm[362])
  const avgTilt = (leftTilt + rightTilt) / 2
  
  let tiltStatus: 'Positive' | 'Neutral' | 'Negative' = 'Neutral'
  if (avgTilt > 2.5) tiltStatus = 'Positive'
  else if (avgTilt < -2.5) tiltStatus = 'Negative'

  // ── 3. Facial Thirds ─────────────────────────────────────
  // Hairline (10), Brows (9), Nose Tip (4), Chin (152)
  const upperD = Math.abs(lm[10].y - lm[9].y)
  const middleD = Math.abs(lm[9].y - lm[4].y)
  const lowerD = Math.abs(lm[4].y - lm[152].y)
  const totalD = upperD + middleD + lowerD || 1
  
  const thirds = {
    upper: Math.round((upperD / totalD) * 100),
    middle: Math.round((middleD / totalD) * 100),
    lower: Math.round((lowerD / totalD) * 100),
  }

  // ── 4. Jawline Width ─────────────────────────────────────
  // Cheekbones (127, 356) vs Jaw angles (234, 454)
  const cheekW = Math.abs(lm[127].x - lm[356].x)
  const jawW = Math.abs(lm[234].x - lm[454].x)
  const jawRatio = jawW / (cheekW || 1)
  
  let jawStatus: 'Strong' | 'Average' | 'Narrow' = 'Average'
  if (jawRatio > 0.85) jawStatus = 'Strong'
  else if (jawRatio < 0.75) jawStatus = 'Narrow'

  // ── Face shape from aspect ratio ─────────────────────────
  const ratio = faceH / faceW
  let faceShape: 'oval' | 'round' | 'square' | 'heart' | 'oblong' | 'unknown' = 'unknown'
  if (ratio < 1.1) faceShape = 'round'
  else if (ratio < 1.25) faceShape = 'oval'
  else if (ratio < 1.4) faceShape = 'oblong'
  else faceShape = 'square'

  return {
    symmetryPercent: Math.min(99, Math.max(50, symmetryPercent)),
    canthalTilt: {
      degrees: Number(avgTilt.toFixed(1)),
      status: tiltStatus,
    },
    thirds,
    jawline: {
      cheekWidth: cheekW,
      jawWidth: jawW,
      ratio: Number(jawRatio.toFixed(2)),
      status: jawStatus,
    },
    rawScore,
    faceShape,
  }
}

export interface FaceMeshAnalysis {
  rawScore: number
  symmetryPercent: number
  faceShape: 'oval' | 'round' | 'square' | 'heart' | 'oblong' | 'unknown'
  jawScore: number
  eyeLevelScore: number
}

export function analyzeFace(results: Results): FaceMeshAnalysis | null {
  if (!results.multiFaceLandmarks?.[0]) return null
  const lm = results.multiFaceLandmarks[0]

  let minY = Infinity, maxY = -Infinity
  let minX = Infinity, maxX = -Infinity
  for (const p of lm) {
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
  }
  const faceH = maxY - minY || 1
  const faceW = maxX - minX || 1
  const midX  = (minX + maxX) / 2

  const diffs: number[] = []
  for (const [l, r] of SYMMETRY_PAIRS) {
    if (l === r) continue
    const dLeft  = Math.abs(lm[l].x - midX) / faceW
    const dRight = Math.abs(lm[r].x - midX) / faceW
    diffs.push(Math.abs(dLeft - dRight))
  }
  const rawScore = diffs.reduce((a, b) => a + b, 0) / diffs.length

  const eyeDY    = Math.abs(lm[33].y - lm[263].y) / faceH
  const eyeLevelScore = Math.max(0, 1 - eyeDY * 10)

  const jawDY    = Math.abs(lm[234].y - lm[454].y) / faceH
  const jawScore = Math.max(0, 1 - jawDY * 8)

  const symmetryRaw     = 1 - Math.min(rawScore * 15, 1)
  const symmetryPercent = Math.round(
    (symmetryRaw * 0.6 + eyeLevelScore * 0.2 + jawScore * 0.2) * 100
  )

  const ratio = faceH / faceW
  let faceShape: FaceMeshAnalysis['faceShape'] = 'unknown'
  if (ratio < 1.1) faceShape = 'round'
  else if (ratio < 1.25) faceShape = 'oval'
  else if (ratio < 1.4) faceShape = 'oblong'
  else faceShape = 'square'

  return {
    rawScore,
    symmetryPercent: Math.min(99, Math.max(60, symmetryPercent)),
    faceShape,
    jawScore: Math.round(jawScore * 100),
    eyeLevelScore: Math.round(eyeLevelScore * 100),
  }
}

// ── FaceMesh singleton factory ────────────────────────────────
let instance: FaceMeshType | null = null

export async function getFaceMesh(
  onResults: (results: Results) => void
): Promise<FaceMeshType> {
  // Dynamically import so it never runs on the server
  const { FaceMesh } = await import('@mediapipe/face_mesh')

  if (!instance) {
    instance = new FaceMesh({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
    })

    instance.setOptions({
      maxNumFaces:          1,
      refineLandmarks:      true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence:  0.6,
    })
  }

  // Replace callback (safe to call multiple times)
  instance.onResults(onResults)

  return instance
}

/** Closes the camera stream tracks */
export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach(t => t.stop())
}

/** Returns constraints optimised for front-facing mobile camera */
export function getFrontCameraConstraints(): MediaStreamConstraints {
  return {
    video: {
      facingMode: 'user',
      width:  { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 },
    },
    audio: false,
  }
}
