import { describe, expect, it } from 'vitest'
import { stabilizeDetectedCode } from '../core/detected-code-stabilizer'
import type { DetectedCode } from '../domain/scanner.types'

function createCode(value: string, offset: number): DetectedCode {
  return {
    value,
    format: 'EAN13',
    symbology: 'EANUPC',
    position: {
      topLeft: { x: 100 + offset, y: 100 + offset },
      topRight: { x: 300 + offset, y: 100 + offset },
      bottomLeft: { x: 100 + offset, y: 180 + offset },
      bottomRight: { x: 300 + offset, y: 180 + offset },
    },
  }
}

describe('стабилизация положения кода', () => {
  it('сразу принимает первый или другой код', () => {
    const first = createCode('first', 0)
    const second = createCode('second', 20)

    expect(stabilizeDetectedCode(null, first)).toBe(first)
    expect(stabilizeDetectedCode(first, second)).toBe(second)
  })

  it('игнорирует мелкий шум координат', () => {
    const previous = createCode('same', 0)

    expect(stabilizeDetectedCode(previous, createCode('same', 3))).toBe(previous)
  })

  it('быстро приближает рамку при заметном перемещении', () => {
    const stabilized = stabilizeDetectedCode(
      createCode('same', 0),
      createCode('same', 50),
    )

    expect(stabilized.position.topLeft).toEqual({ x: 135, y: 135 })
    expect(stabilized.position.bottomRight).toEqual({ x: 335, y: 215 })
  })

  it('мягче сглаживает небольшое перемещение', () => {
    const stabilized = stabilizeDetectedCode(
      createCode('same', 0),
      createCode('same', 10),
    )

    expect(stabilized.position.topLeft).toEqual({ x: 103.5, y: 103.5 })
  })

  it('не задерживает очень большое перемещение', () => {
    const next = createCode('same', 200)

    expect(stabilizeDetectedCode(createCode('same', 0), next).position).toEqual(next.position)
  })
})
