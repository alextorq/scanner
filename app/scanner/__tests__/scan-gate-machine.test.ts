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
  it('не учитывает попытку без нажатия', () => {
    const transition = transitionScanGate(initialScanGateState, {
      type: 'ATTEMPT_FINISHED',
      code,
    })

    expect(transition.outcome).toBeUndefined()
    expect(transition.state).toEqual({ value: 'waiting' })
  })

  it('запускает заданное число попыток', () => {
    const transition = transitionScanGate(initialScanGateState, {
      type: 'TRIGGER',
      attempts: 6,
    })

    expect(transition.state).toEqual({ value: 'scanning', attemptsRemaining: 6 })
  })

  it('уменьшает счётчик после пустой попытки', () => {
    const scanning = transitionScanGate(initialScanGateState, {
      type: 'TRIGGER',
      attempts: 3,
    }).state
    const transition = transitionScanGate(scanning, { type: 'ATTEMPT_FINISHED' })

    expect(transition.state).toEqual({ value: 'scanning', attemptsRemaining: 2 })
    expect(transition.outcome).toBeUndefined()
  })

  it('сразу успешно завершает сессию при найденном коде', () => {
    const scanning = transitionScanGate(initialScanGateState, {
      type: 'TRIGGER',
      attempts: 3,
    }).state
    const transition = transitionScanGate(scanning, {
      type: 'ATTEMPT_FINISHED',
      code,
    })

    expect(transition.state).toEqual({ value: 'waiting' })
    expect(transition.outcome).toEqual({ type: 'success', code })
  })

  it('завершает сессию неудачей после последней пустой попытки', () => {
    const scanning = transitionScanGate(initialScanGateState, {
      type: 'TRIGGER',
      attempts: 1,
    }).state
    const transition = transitionScanGate(scanning, { type: 'ATTEMPT_FINISHED' })

    expect(transition.state).toEqual({ value: 'waiting' })
    expect(transition.outcome).toEqual({ type: 'failure' })
  })

  it('сбрасывает сканирование при отмене', () => {
    const scanning = transitionScanGate(initialScanGateState, {
      type: 'TRIGGER',
      attempts: 3,
    }).state

    expect(transitionScanGate(scanning, { type: 'CANCEL' }).state)
      .toEqual({ value: 'waiting' })
  })
})
