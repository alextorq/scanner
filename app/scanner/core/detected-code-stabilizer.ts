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
