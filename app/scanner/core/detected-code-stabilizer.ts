import type { DetectedCode, Point } from '../domain/scanner.types'

const SLOW_SMOOTHING_FACTOR = 0.35
const FAST_SMOOTHING_FACTOR = 0.7
const DEAD_ZONE_PX = 6
const FAST_DISTANCE_PX = 40
const SNAP_DISTANCE_PX = 100

/** Reduces frame-to-frame locator noise without losing large real movements. */
export function stabilizeDetectedCode(
  previous: DetectedCode | null,
  next: DetectedCode,
): DetectedCode {
  if (!previous || previous.value !== next.value || previous.format !== next.format) {
    return next
  }

  let changed = false
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

    const smoothingFactor = distance >= FAST_DISTANCE_PX
      ? FAST_SMOOTHING_FACTOR
      : SLOW_SMOOTHING_FACTOR
    changed = true
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
