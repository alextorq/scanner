import { describe, expect, it } from 'vitest'
import { calculateCoverCrop, fitWithin } from '../core/frame-geometry'

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
})
