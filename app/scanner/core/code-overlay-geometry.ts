import type { DetectedCode, Point } from '../domain/scanner.types'
import type { FrameSize } from './frame-geometry'

const MATRIX_SYMBOLOGIES = new Set([
  'Aztec',
  'DataMatrix',
  'MaxiCode',
  'PDF417',
  'QRCode',
])

const LINEAR_HEIGHT_RATIOS: Record<string, number> = {
  EANUPC: 0.7,
  EAN13: 0.7,
  ISBN: 0.7,
  UPCA: 0.7,
  EAN8: 0.8,
  UPCE: 0.8,
  DataBar: 0.4,
  Code39: 0.35,
  Code93: 0.32,
  Codabar: 0.32,
  ITF: 0.32,
  Code128: 0.3,
  Telepen: 0.3,
}

const DEFAULT_LINEAR_HEIGHT_RATIO = 0.3

/**
 * ZXing can locate a linear barcode from only a few successful scan lines.
 * In that case its quadrilateral has almost no height, so expand it around
 * the detected bar direction for a useful camera overlay.
 */
export function getCodeOverlayCorners(code: DetectedCode, frame: FrameSize): Point[] {
  const corners = [
    code.position.topLeft,
    code.position.topRight,
    code.position.bottomRight,
    code.position.bottomLeft,
  ]

  if (MATRIX_SYMBOLOGIES.has(code.symbology)) {
    return corners
  }

  const [topLeft, topRight, bottomRight, bottomLeft] = corners as [Point, Point, Point, Point]
  const directionX = ((topRight.x - topLeft.x) + (bottomRight.x - bottomLeft.x)) / 2
  const directionY = ((topRight.y - topLeft.y) + (bottomRight.y - bottomLeft.y)) / 2
  const directionLength = Math.hypot(directionX, directionY)

  if (directionLength < 1 || frame.width <= 0 || frame.height <= 0) {
    return corners
  }

  const axisX = directionX / directionLength
  const axisY = directionY / directionLength
  let normalX = -axisY
  let normalY = axisX
  const topCenter = midpoint(topLeft, topRight)
  const bottomCenter = midpoint(bottomLeft, bottomRight)
  const detectedHeightDirection = (bottomCenter.x - topCenter.x) * normalX
    + (bottomCenter.y - topCenter.y) * normalY

  if (detectedHeightDirection < 0 || (Math.abs(detectedHeightDirection) < 0.001 && normalY < 0)) {
    normalX *= -1
    normalY *= -1
  }

  const center = {
    x: corners.reduce((sum, point) => sum + point.x, 0) / corners.length,
    y: corners.reduce((sum, point) => sum + point.y, 0) / corners.length,
  }
  const projections = corners.map(point => ({
    along: (point.x - center.x) * axisX + (point.y - center.y) * axisY,
    across: (point.x - center.x) * normalX + (point.y - center.y) * normalY,
  }))
  const minAlong = Math.min(...projections.map(point => point.along))
  const maxAlong = Math.max(...projections.map(point => point.along))
  const minAcross = Math.min(...projections.map(point => point.across))
  const maxAcross = Math.max(...projections.map(point => point.across))
  const detectedHeight = maxAcross - minAcross
  const detectedWidth = maxAlong - minAlong
  const heightRatio = LINEAR_HEIGHT_RATIOS[code.format]
    ?? LINEAR_HEIGHT_RATIOS[code.symbology]
    ?? DEFAULT_LINEAR_HEIGHT_RATIO
  const minimumHeight = Math.min(
    frame.height * 0.38,
    Math.max(frame.height * 0.08, detectedWidth * heightRatio),
  )

  if (detectedHeight >= minimumHeight) {
    return corners
  }

  const acrossCenter = (minAcross + maxAcross) / 2
  const top = acrossCenter - minimumHeight / 2
  const bottom = acrossCenter + minimumHeight / 2
  const pointAt = (along: number, across: number): Point => ({
    x: center.x + axisX * along + normalX * across,
    y: center.y + axisY * along + normalY * across,
  })

  return [
    pointAt(minAlong, top),
    pointAt(maxAlong, top),
    pointAt(maxAlong, bottom),
    pointAt(minAlong, bottom),
  ]
}

function midpoint(first: Point, second: Point): Point {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  }
}
