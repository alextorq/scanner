import { describe, expect, it } from 'vitest'
import { getCodeOverlayCorners } from '../core/code-overlay-geometry'
import type { DetectedCode } from '../domain/scanner.types'

function createCode(symbology: string, top: number, bottom: number): DetectedCode {
  return {
    value: '4601234567890',
    format: 'EAN13',
    symbology,
    position: {
      topLeft: { x: 100, y: top },
      topRight: { x: 300, y: top },
      bottomRight: { x: 300, y: bottom },
      bottomLeft: { x: 100, y: bottom },
    },
  }
}

describe('геометрия подсветки кода', () => {
  it('добавляет высоту тонкой области линейного штрихкода', () => {
    const corners = getCodeOverlayCorners(createCode('EANUPC', 149, 151), {
      width: 400,
      height: 300,
    })

    const height = Math.max(...corners.map(point => point.y))
      - Math.min(...corners.map(point => point.y))

    expect(height).toBeCloseTo(56)
    expect(corners[0]?.x).toBeCloseTo(100)
    expect(corners[1]?.x).toBeCloseTo(300)
  })

  it('сохраняет настоящие границы двумерного кода', () => {
    const code = createCode('QRCode', 80, 220)

    expect(getCodeOverlayCorners(code, { width: 400, height: 300 })).toEqual([
      code.position.topLeft,
      code.position.topRight,
      code.position.bottomRight,
      code.position.bottomLeft,
    ])
  })

  it('не расширяет линейный код с уже найденной высотой', () => {
    const code = createCode('Code128', 100, 200)

    expect(getCodeOverlayCorners(code, { width: 400, height: 300 })).toEqual([
      code.position.topLeft,
      code.position.topRight,
      code.position.bottomRight,
      code.position.bottomLeft,
    ])
  })
})
