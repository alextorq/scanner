import { describe, expect, it } from 'vitest'
import { initialScanGateState, transitionScanGate } from '../domain/scan-gate-machine'
import type { DetectedCode } from '../domain/scanner.types'

const code: DetectedCode = {
  value: '4601234567890',
  format: 'EAN13',
  symbology: 'EANUPC',
  position: {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 1, y: 0 },
    bottomLeft: { x: 0, y: 1 },
    bottomRight: { x: 1, y: 1 },
  },
}

describe('автомат выдачи скана', () => {
  it('не выдаёт код без нажатия', () => {
    const transition = transitionScanGate(initialScanGateState, {
      type: 'CODE_DETECTED',
      code,
    })

    expect(transition.output).toBeUndefined()
    expect(transition.state).toEqual({ value: 'waiting' })
  })

  it('выдаёт первый код после нажатия и сразу закрывает затвор', () => {
    const armed = transitionScanGate(initialScanGateState, { type: 'TRIGGER' }).state
    const scanned = transitionScanGate(armed, { type: 'CODE_DETECTED', code })
    const repeated = transitionScanGate(scanned.state, { type: 'CODE_DETECTED', code })

    expect(scanned.output).toBe(code)
    expect(scanned.state).toEqual({ value: 'waiting' })
    expect(repeated.output).toBeUndefined()
  })

  it('сбрасывает ожидание при отмене', () => {
    const armed = transitionScanGate(initialScanGateState, { type: 'TRIGGER' }).state

    expect(transitionScanGate(armed, { type: 'CANCEL' }).state).toEqual({ value: 'waiting' })
  })
})
