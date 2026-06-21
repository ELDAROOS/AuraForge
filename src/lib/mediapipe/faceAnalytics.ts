/**
 * AuraForge — Face Analytics Engine v2
 * ======================================
 * Pure math utilities for landmark-based facial morphometry.
 * No React, no MediaPipe imports — just numbers in, results out.
 *
 * All functions accept a Landmark[] (normalized 0-1 x/y/z coords).
 */

export interface Landmark {
  x: number
  y: number
  z?: number
}

// ─── MEDIAPIPE LANDMARK INDEX ATLAS ─────────────────────────────────────────
// https://github.com/google/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
export const LM = {
  // Symmetry pairs (left, right)
  INNER_EYE_L:    33,  INNER_EYE_R:   263,
  OUTER_EYE_L:   133,  OUTER_EYE_R:   362,
  UPPER_LID_L:   159,  UPPER_LID_R:   386,
  LOWER_LID_L:   145,  LOWER_LID_R:   374,
  BROW_INNER_L:   70,  BROW_INNER_R:  300,
  BROW_ARCH_L:   107,  BROW_ARCH_R:   336,
  MOUTH_L:        61,  MOUTH_R:       291,
  UPPER_LIP_L:    40,  UPPER_LIP_R:   270,
  JAW_L:         234,  JAW_R:         454,
  CHEEK_L:       127,  CHEEK_R:       356,
  LOW_CHEEK_L:    58,  LOW_CHEEK_R:   288,

  // Midline
  NOSE_TIP:        4,
  CHIN:          152,
  FOREHEAD:       10,
  BROW_CENTER:     9,

  // Additional biometric points
  ZYGOMATIC_L:   234,  ZYGOMATIC_R:   454,   // cheekbone width (same as jaw in MediaPipe)
  TEMPLE_L:      127,  TEMPLE_R:       356,   // temple / forehead width
  GONION_L:      172,  GONION_R:       397,   // jaw angles (gonions)
  MENTON:        152,                          // chin bottom
  FOREHEAD_L:      54, FOREHEAD_R:     284,   // forehead width
}

// ─── SYMMETRY PAIRS for diffs ────────────────────────────────────────────────
const SYMMETRY_PAIRS: [number, number][] = [
  [LM.INNER_EYE_L, LM.INNER_EYE_R],
  [LM.OUTER_EYE_L, LM.OUTER_EYE_R],
  [LM.UPPER_LID_L, LM.UPPER_LID_R],
  [LM.LOWER_LID_L, LM.LOWER_LID_R],
  [LM.BROW_INNER_L, LM.BROW_INNER_R],
  [LM.BROW_ARCH_L, LM.BROW_ARCH_R],
  [LM.MOUTH_L, LM.MOUTH_R],
  [LM.JAW_L, LM.JAW_R],
  [LM.CHEEK_L, LM.CHEEK_R],
  [LM.LOW_CHEEK_L, LM.LOW_CHEEK_R],
]

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type FaceTier =
  | 'sub3'  // Critical asymmetries
  | 'sub5'  // Below average
  | 'ltn'   // Low-Tier Normie
  | 'mtn'   // Mid-Tier Normie
  | 'htn'   // High-Tier Normie
  | 'chad'  // Outstanding genetics
  | 'adam'  // Theoretical maximum

export type FaceShape = 'oval' | 'diamond' | 'square' | 'heart' | 'oblong' | 'round'
export type CanthalStatus = 'Positive' | 'Neutral' | 'Negative'
export type JawStatus = 'Strong' | 'Average' | 'Narrow'

export interface FaceAnalysisResult {
  // ── Scores (0–100)
  symmetryScore:    number
  proportionScore:  number
  canthalScore:     number
  jawScore:         number
  fwhrScore:        number
  finalScore:       number   // weighted composite

  // ── Tier
  tier:             FaceTier

  // ── Shape
  faceShape:        FaceShape

  // ── Raw measurements
  fwhr:             number   // Facial Width-to-Height Ratio
  canthalTilt:      { degrees: number; status: CanthalStatus }
  jawline:          { ratio: number; status: JawStatus }
  facialThirds:     { upper: number; middle: number; lower: number }

  // Internal
  rawSymmetry:      number
}

// ─── UTILITY MATH ─────────────────────────────────────────────────────────────

function dist2d(a: Landmark, b: Landmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function angle2d(from: Landmark, to: Landmark): number {
  return Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI)
}

// ─── FRAME AVERAGING ──────────────────────────────────────────────────────────

/**
 * Averages N frames of landmarks into a single stable landmark set.
 * This removes jitter from micro-movements and camera noise.
 */
export function averageLandmarks(frames: Landmark[][]): Landmark[] {
  if (frames.length === 0) return []
  const count = frames.length
  const n     = frames[0].length

  const result: Landmark[] = new Array(n)
  for (let i = 0; i < n; i++) {
    let sx = 0, sy = 0, sz = 0
    for (const frame of frames) {
      sx += frame[i].x
      sy += frame[i].y
      sz += (frame[i].z ?? 0)
    }
    result[i] = { x: sx / count, y: sy / count, z: sz / count }
  }
  return result
}

// ─── BOUNDING BOX ─────────────────────────────────────────────────────────────

function boundingBox(lm: Landmark[]) {
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  for (const p of lm) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return {
    minX, maxX, minY, maxY,
    faceW: maxX - minX || 1,
    faceH: maxY - minY || 1,
    midX: (minX + maxX) / 2,
  }
}

// ─── 1. SYMMETRY ──────────────────────────────────────────────────────────────

function calcSymmetry(lm: Landmark[]): { score: number; raw: number } {
  const { faceW, faceH, midX } = boundingBox(lm)

  const diffs: number[] = []
  for (const [l, r] of SYMMETRY_PAIRS) {
    // Horizontal distance from face midline
    const dLeft  = Math.abs(lm[l].x - midX) / faceW
    const dRight = Math.abs(lm[r].x - midX) / faceW
    // Vertical misalignment
    const yDiff  = Math.abs(lm[l].y - lm[r].y) / faceH

    diffs.push(Math.abs(dLeft - dRight) * 1.5 + yDiff * 0.5)
  }

  const raw = diffs.reduce((a, b) => a + b, 0) / diffs.length

  // Eye and jaw levelness bonus
  const eyeDY  = Math.abs(lm[LM.INNER_EYE_L].y - lm[LM.INNER_EYE_R].y) / faceH
  const jawDY  = Math.abs(lm[LM.JAW_L].y - lm[LM.JAW_R].y) / faceH
  const level  = Math.max(0, 1 - (eyeDY + jawDY) * 6)

  const symRaw = 1 - Math.min(raw * 12, 1)
  const score  = Math.round((symRaw * 0.75 + level * 0.25) * 100)

  return { score: clamp(score, 40, 99), raw }
}

// ─── 2. CANTHAL TILT ──────────────────────────────────────────────────────────

/**
 * Canthal tilt = angle at which the eye opening is tilted.
 * Measured from inner (medial) to outer (lateral) canthus.
 * Positive (upward) = hunter eyes. Negative = downward slant.
 */
function calcCanthalTilt(lm: Landmark[]): { degrees: number; status: CanthalStatus; score: number } {
  // Y increases downward → positive angle = outer corner is HIGHER (negative y delta)
  const leftAngle  = -angle2d(lm[LM.INNER_EYE_L], lm[LM.OUTER_EYE_L])   // left eye
  const rightAngle = -angle2d(lm[LM.INNER_EYE_R], lm[LM.OUTER_EYE_R])   // right eye — mirrored

  // Negate right because x coords go opposite direction for mirrored face
  const avg = (leftAngle - rightAngle) / 2
  const deg = Number(avg.toFixed(1))

  let status: CanthalStatus = 'Neutral'
  if (deg > 2.0) status = 'Positive'
  else if (deg < -2.0) status = 'Negative'

  // Score: Positive > Neutral > Negative (looksmaxxing preference)
  const score = status === 'Positive' ? 90
    : status === 'Neutral'   ? 65
    : 40

  return { degrees: deg, status, score }
}

// ─── 3. FWHR (Facial Width-to-Height Ratio) ───────────────────────────────────

/**
 * FWHR = bizygomatic width / face height (brow to lip).
 * Research suggests ~1.8–2.0 is associated with dominant masculine features.
 * For female: ~1.6–1.8 is considered attractive.
 */
function calcFWHR(lm: Landmark[]): { value: number; score: number } {
  const cheekWidth  = dist2d(lm[LM.ZYGOMATIC_L], lm[LM.ZYGOMATIC_R])
  const faceHeight  = dist2d(lm[LM.BROW_CENTER], lm[LM.MOUTH_L])  // brow to lip

  const fwhr = faceHeight > 0 ? cheekWidth / faceHeight : 1.5
  const val  = Number(fwhr.toFixed(2))

  // Ideal range 1.7 – 2.0 → score peaks at 1.85
  const ideal = 1.85
  const deviation = Math.abs(fwhr - ideal)
  const score = Math.round(Math.max(0, 100 - deviation * 120))

  return { value: val, score: clamp(score, 20, 95) }
}

// ─── 4. JAWLINE ANGULARITY ────────────────────────────────────────────────────

function calcJawline(lm: Landmark[]): { ratio: number; status: JawStatus; score: number } {
  const cheekW = dist2d(lm[LM.CHEEK_L], lm[LM.CHEEK_R])
  const jawW   = dist2d(lm[LM.JAW_L], lm[LM.JAW_R])

  const ratio  = cheekW > 0 ? jawW / cheekW : 0.8
  const val    = Number(ratio.toFixed(2))

  let status: JawStatus = 'Average'
  if (ratio > 0.84) status = 'Strong'
  else if (ratio < 0.72) status = 'Narrow'

  const score = status === 'Strong' ? 90 : status === 'Average' ? 65 : 35

  return { ratio: val, status, score }
}

// ─── 5. FACIAL THIRDS ─────────────────────────────────────────────────────────

function calcThirds(lm: Landmark[]): { upper: number; middle: number; lower: number; score: number } {
  const upper  = dist2d(lm[LM.FOREHEAD], lm[LM.BROW_CENTER])
  const middle = dist2d(lm[LM.BROW_CENTER], lm[LM.NOSE_TIP])
  const lower  = dist2d(lm[LM.NOSE_TIP], lm[LM.CHIN])
  const total  = upper + middle + lower || 1

  const uPct = Math.round((upper  / total) * 100)
  const mPct = Math.round((middle / total) * 100)
  const lPct = Math.round((lower  / total) * 100)

  // Ideal: equal thirds = 33.3% each
  const deviation = Math.abs(uPct - 33) + Math.abs(mPct - 33) + Math.abs(lPct - 34)
  const score = Math.round(Math.max(0, 100 - deviation * 1.5))

  return { upper: uPct, middle: mPct, lower: lPct, score: clamp(score, 30, 95) }
}

// ─── 6. FACE SHAPE ────────────────────────────────────────────────────────────

/**
 * Determines face shape using forehead, cheekbone, jaw widths
 * and face height relative to cheekbone width.
 */
function calcFaceShape(lm: Landmark[]): FaceShape {
  const foreheadW = dist2d(lm[LM.FOREHEAD_L], lm[LM.FOREHEAD_R])
  const cheekW    = dist2d(lm[LM.CHEEK_L], lm[LM.CHEEK_R])
  const jawW      = dist2d(lm[LM.JAW_L], lm[LM.JAW_R])
  const { faceH, faceW } = boundingBox(lm)

  const heightRatio = faceH / (faceW || 1)

  const maxW = Math.max(foreheadW, cheekW, jawW)

  if (heightRatio < 1.12 && Math.abs(cheekW - jawW) < 0.02) return 'round'

  if (cheekW >= foreheadW && cheekW >= jawW) {
    if (heightRatio > 1.35) return 'diamond'
    if (Math.abs(jawW - foreheadW) < 0.03) return 'oval'
    return 'diamond'
  }

  if (foreheadW >= cheekW && foreheadW >= jawW) {
    if (jawW < foreheadW * 0.75) return 'heart'
    if (heightRatio < 1.2) return 'square'
    return 'oblong'
  }

  if (jawW >= cheekW && jawW >= foreheadW) {
    return 'square'
  }

  const ratio = faceH / (faceW || 1)
  if (ratio < 1.1) return 'round'
  if (ratio < 1.25) return 'oval'
  if (ratio < 1.4) return 'oblong'
  return 'square'
}

// ─── 7. PROPORTIONS COMPOSITE ────────────────────────────────────────────────

function calcProportionScore(thirdsScore: number, fwhrScore: number): number {
  return Math.round(thirdsScore * 0.5 + fwhrScore * 0.5)
}

// ─── 8. FINAL SCORE ───────────────────────────────────────────────────────────

/**
 * Weighted composite score:
 * Symmetry 35% + Canthal 25% + Jaw 20% + Proportions 20%
 */
function calcFinalScore(
  symmetry: number,
  canthal: number,
  jaw: number,
  proportion: number
): number {
  return Math.round(
    symmetry   * 0.35 +
    canthal    * 0.25 +
    jaw        * 0.20 +
    proportion * 0.20
  )
}

// ─── 9. TIER SYSTEM ──────────────────────────────────────────────────────────

/**
 * Converts final score to Looksmaxxing tier string.
 */
export function scoreToTier(score: number): FaceTier {
  if (score >= 97) return 'adam'
  if (score >= 88) return 'chad'
  if (score >= 77) return 'htn'
  if (score >= 63) return 'mtn'
  if (score >= 50) return 'ltn'
  if (score >= 38) return 'sub5'
  return 'sub3'
}

export const TIER_META: Record<FaceTier, {
  label: string
  description: string
  color: string
  bgClass: string
}> = {
  adam: {
    label: 'ADAM',
    description: 'Теоретический идеал. Боженька одарил.',
    color: '#f5f5f4',
    bgClass: 'bg-zinc-100 text-black',
  },
  chad: {
    label: 'CHAD',
    description: 'Выдающаяся генетика. Идеальные углы и пропорции.',
    color: '#a3e635',
    bgClass: 'bg-lime-400/20 text-lime-400 border border-lime-400/30',
  },
  htn: {
    label: 'HTN',
    description: 'High-Tier Normie. Привлекательный по всем параметрам.',
    color: '#34d399',
    bgClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  },
  mtn: {
    label: 'MTN',
    description: 'Mid-Tier Normie. Средний уровень, есть потенциал.',
    color: '#94a3b8',
    bgClass: 'bg-zinc-700/60 text-zinc-300 border border-zinc-600',
  },
  ltn: {
    label: 'LTN',
    description: 'Low-Tier Normie. Значительные зоны роста.',
    color: '#f59e0b',
    bgClass: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  },
  sub5: {
    label: 'SUB 5',
    description: 'Ниже среднего. Срочно начинай looksmaxxing.',
    color: '#f97316',
    bgClass: 'bg-orange-500/10 text-orange-400 border border-orange-500/30',
  },
  sub3: {
    label: 'SUB 3',
    description: 'Критичные асимметрии. Смотри к специалисту.',
    color: '#ef4444',
    bgClass: 'bg-red-500/10 text-red-400 border border-red-500/30',
  },
}

// ─── MAIN ANALYSIS FUNCTION ───────────────────────────────────────────────────

/**
 * Full biometric analysis from averaged landmarks.
 * Call with `averageLandmarks(frames)` first for stable results.
 */
export function analyzeLandmarks(lm: Landmark[]): FaceAnalysisResult {
  if (lm.length < 400) {
    throw new Error(`Expected ≥400 landmarks, got ${lm.length}`)
  }

  const symmetry    = calcSymmetry(lm)
  const canthal     = calcCanthalTilt(lm)
  const fwhr        = calcFWHR(lm)
  const jaw         = calcJawline(lm)
  const thirds      = calcThirds(lm)
  const proportion  = calcProportionScore(thirds.score, fwhr.score)
  const finalScore  = calcFinalScore(symmetry.score, canthal.score, jaw.score, proportion)
  const tier        = scoreToTier(finalScore)
  const faceShape   = calcFaceShape(lm)

  return {
    symmetryScore:   symmetry.score,
    proportionScore: proportion,
    canthalScore:    canthal.score,
    jawScore:        jaw.score,
    fwhrScore:       fwhr.score,
    finalScore:      clamp(finalScore, 10, 99),

    tier,
    faceShape,

    fwhr:           fwhr.value,
    canthalTilt:    { degrees: canthal.degrees, status: canthal.status },
    jawline:        { ratio: jaw.ratio, status: jaw.status },
    facialThirds:   { upper: thirds.upper, middle: thirds.middle, lower: thirds.lower },

    rawSymmetry:    symmetry.raw,
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
