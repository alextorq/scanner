import type { CodePosition, Point } from '../domain/scanner.types'

export interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

export interface FrameSize {
  width: number
  height: number
}

export interface RelativeRectangle {
  x: number
  y: number
  width: number
  height: number
}

/** Static camera guide and the only region sent to the barcode decoder. */
export const FOCUS_REGION: RelativeRectangle = {
  x: 0.11,
  y: 0.18,
  width: 0.78,
  height: 0.64,
}

/** Рассчитывает центральное кадрирование, эквивалентное object-fit: cover. */
export function calculateCoverCrop(source: FrameSize, target: FrameSize): Rectangle {
  if (source.width <= 0 || source.height <= 0 || target.width <= 0 || target.height <= 0) {
    throw new RangeError('Размеры кадра должны быть положительными')
  }

  const sourceRatio = source.width / source.height
  const targetRatio = target.width / target.height

  if (sourceRatio > targetRatio) {
    const width = source.height * targetRatio
    return { x: (source.width - width) / 2, y: 0, width, height: source.height }
  }

  const height = source.width / targetRatio
  return { x: 0, y: (source.height - height) / 2, width: source.width, height }
}

/** Ограничивает число пикселей без изменения пропорций кадра. */
export function fitWithin(source: FrameSize, maxLongEdge: number): FrameSize {
  if (source.width <= 0 || source.height <= 0 || maxLongEdge <= 0) {
    throw new RangeError('Размеры кадра должны быть положительными')
  }

  const scale = Math.min(1, maxLongEdge / Math.max(source.width, source.height))
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  }
}

/** Converts a normalized region into integer pixel coordinates. */
export function calculateRelativeRegion(
  frame: FrameSize,
  region: RelativeRectangle,
): Rectangle {
  if (
    frame.width <= 0
    || frame.height <= 0
    || region.x < 0
    || region.y < 0
    || region.width <= 0
    || region.height <= 0
    || region.x + region.width > 1
    || region.y + region.height > 1
  ) {
    throw new RangeError('Область анализа должна находиться внутри кадра')
  }

  const x = Math.round(frame.width * region.x)
  const y = Math.round(frame.height * region.y)
  const right = Math.round(frame.width * (region.x + region.width))
  const bottom = Math.round(frame.height * (region.y + region.height))

  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  }
}

export function translateCodePosition(position: CodePosition, offset: Point): CodePosition {
  const translate = (point: Point): Point => ({
    x: point.x + offset.x,
    y: point.y + offset.y,
  })

  return {
    topLeft: translate(position.topLeft),
    topRight: translate(position.topRight),
    bottomLeft: translate(position.bottomLeft),
    bottomRight: translate(position.bottomRight),
  }
}
