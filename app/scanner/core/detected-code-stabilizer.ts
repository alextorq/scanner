import type { DetectedCode, Point } from '../domain/scanner.types'

const SLOW_SMOOTHING_FACTOR = 0.55
const FAST_SMOOTHING_FACTOR = 0.85
const DEAD_ZONE_PX = 5
const FAST_DISTANCE_PX = 30
const SNAP_DISTANCE_PX = 80
const LINEAR_ACROSS_SMOOTHING_FACTOR = 0.18
const MATRIX_SYMBOLOGIES = new Set([
  'Aztec',
  'DataMatrix',
  'MaxiCode',
  'PDF417',
  'QRCode',
])

/** Reduces frame-to-frame locator noise without losing large real movements. */
export function stabilizeDetectedCode(
  previous: DetectedCode | null,
  next: DetectedCode,
): DetectedCode {
  if (!previous || previous.value !== next.value || previous.format !== next.format) {
    return next
  }

  let changed = false
  const axis = barcodeAxis(previous)
  const stabilizePoint = (previousPoint: Point, nextPoint: Point): Point => {
    const distance = Math.hypot(
      nextPoint.x - previousPoint.x,
      nextPoint.y - previousPoint.y,
    )

    if (distance <= DEAD_ZONE_PX) {
      return previousPoint
    }

    if (distance >= SNAP_DISTANCE_PX) {
      changed = true
      return nextPoint
    }

    const alongDistance = (nextPoint.x - previousPoint.x) * axis.x
      + (nextPoint.y - previousPoint.y) * axis.y
    const smoothingFactor = Math.abs(alongDistance) >= FAST_DISTANCE_PX
      ? FAST_SMOOTHING_FACTOR
      : SLOW_SMOOTHING_FACTOR
    changed = true

    if (!MATRIX_SYMBOLOGIES.has(next.symbology)) {
      const normal = { x: -axis.y, y: axis.x }
      const acrossDistance = (nextPoint.x - previousPoint.x) * normal.x
        + (nextPoint.y - previousPoint.y) * normal.y

      return {
        x: previousPoint.x
          + axis.x * alongDistance * smoothingFactor
          + normal.x * acrossDistance * LINEAR_ACROSS_SMOOTHING_FACTOR,
        y: previousPoint.y
          + axis.y * alongDistance * smoothingFactor
          + normal.y * acrossDistance * LINEAR_ACROSS_SMOOTHING_FACTOR,
      }
    }

    return {
      x: previousPoint.x + (nextPoint.x - previousPoint.x) * smoothingFactor,
      y: previousPoint.y + (nextPoint.y - previousPoint.y) * smoothingFactor,
    }
  }

  const position = {
    topLeft: stabilizePoint(previous.position.topLeft, next.position.topLeft),
    topRight: stabilizePoint(previous.position.topRight, next.position.topRight),
    bottomLeft: stabilizePoint(previous.position.bottomLeft, next.position.bottomLeft),
    bottomRight: stabilizePoint(previous.position.bottomRight, next.position.bottomRight),
  }

  return changed ? { ...next, position } : previous
}

/** Interpolates the visible overlay independently from the decoder cadence. */
export function interpolateDetectedCode(
  current: DetectedCode,
  target: DetectedCode,
  progress: number,
): DetectedCode {
  if (current.value !== target.value || current.format !== target.format) {
    return target
  }

  const amount = Math.min(1, Math.max(0, progress))
  const interpolatePoint = (from: Point, to: Point): Point => ({
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  })

  return {
    ...target,
    position: {
      topLeft: interpolatePoint(current.position.topLeft, target.position.topLeft),
      topRight: interpolatePoint(current.position.topRight, target.position.topRight),
      bottomLeft: interpolatePoint(current.position.bottomLeft, target.position.bottomLeft),
      bottomRight: interpolatePoint(current.position.bottomRight, target.position.bottomRight),
    },
  }
}

export function detectedCodePositionDistance(
  current: DetectedCode,
  target: DetectedCode,
): number {
  if (current.value !== target.value || current.format !== target.format) {
    return Number.POSITIVE_INFINITY
  }

  return Math.max(
    pointDistance(current.position.topLeft, target.position.topLeft),
    pointDistance(current.position.topRight, target.position.topRight),
    pointDistance(current.position.bottomLeft, target.position.bottomLeft),
    pointDistance(current.position.bottomRight, target.position.bottomRight),
  )
}

function pointDistance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y)
}

function barcodeAxis(code: DetectedCode): Point {
  const { topLeft, topRight, bottomLeft, bottomRight } = code.position
  const x = ((topRight.x - topLeft.x) + (bottomRight.x - bottomLeft.x)) / 2
  const y = ((topRight.y - topLeft.y) + (bottomRight.y - bottomLeft.y)) / 2
  const length = Math.hypot(x, y)

  return length >= 1 ? { x: x / length, y: y / length } : { x: 1, y: 0 }
}
