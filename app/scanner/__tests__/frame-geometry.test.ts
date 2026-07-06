import { describe, expect, it } from 'vitest'
import {
  calculateCoverCrop,
  calculateRelativeRegion,
  fitWithin,
  FOCUS_REGION,
  translateCodePosition,
} from '../core/frame-geometry'

describe('геометрия видеокадра', () => {
  it('обрезает широкий источник по бокам', () => {
    const crop = calculateCoverCrop(
      { width: 1920, height: 1080 },
      { width: 400, height: 300 },
    )

    expect(crop).toEqual({ x: 240, y: 0, width: 1440, height: 1080 })
  })

  it('обрезает высокий источник сверху и снизу', () => {
    const crop = calculateCoverCrop(
      { width: 1080, height: 1920 },
      { width: 400, height: 300 },
    )

    expect(crop.x).toBe(0)
    expect(crop.y).toBe(555)
    expect(crop.width).toBe(1080)
    expect(crop.height).toBe(810)
  })

  it('уменьшает кадр с сохранением пропорций', () => {
    expect(fitWithin({ width: 1440, height: 1080 }, 1024))
      .toEqual({ width: 1024, height: 768 })
  })

  it('не увеличивает небольшой кадр', () => {
    expect(fitWithin({ width: 640, height: 480 }, 1024))
      .toEqual({ width: 640, height: 480 })
  })

  it('вычисляет область анализа по статической фокусной рамке', () => {
    const region = calculateRelativeRegion({ width: 1024, height: 768 }, FOCUS_REGION)

    expect(region).toEqual({ x: 113, y: 138, width: 798, height: 492 })
    expect(region.width * region.height).toBeLessThan(1024 * 768 * 0.51)
  })

  it('возвращает координаты к системе полного кадра', () => {
    expect(translateCodePosition({
      topLeft: { x: 0, y: 0 },
      topRight: { x: 100, y: 0 },
      bottomLeft: { x: 0, y: 50 },
      bottomRight: { x: 100, y: 50 },
    }, { x: 113, y: 138 })).toEqual({
      topLeft: { x: 113, y: 138 },
      topRight: { x: 213, y: 138 },
      bottomLeft: { x: 113, y: 188 },
      bottomRight: { x: 213, y: 188 },
    })
  })
})
