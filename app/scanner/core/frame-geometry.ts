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
