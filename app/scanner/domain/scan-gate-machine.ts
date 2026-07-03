import type { DetectedCode } from './scanner.types'

export type ScanGateState =
  | { value: 'waiting' }
  | { value: 'scanning'; attemptsRemaining: number }

export type ScanGateEvent =
  | { type: 'TRIGGER'; attempts: number }
  | { type: 'CANCEL' }
  | { type: 'ATTEMPT_FINISHED'; code?: DetectedCode }

export type ScanGateOutcome =
  | { type: 'success'; code: DetectedCode }
  | { type: 'failure' }

export interface ScanGateTransition {
  state: ScanGateState
  outcome?: ScanGateOutcome
}

export const initialScanGateState: ScanGateState = { value: 'waiting' }

/** Автомат ограничивает одну сессию заданным числом попыток распознавания. */
export function transitionScanGate(
  state: ScanGateState,
  event: ScanGateEvent,
): ScanGateTransition {
  if (event.type === 'TRIGGER') {
    return {
      state: {
        value: 'scanning',
        attemptsRemaining: Math.max(1, Math.floor(event.attempts)),
      },
    }
  }

  if (event.type === 'CANCEL') {
    return { state: initialScanGateState }
  }

  if (state.value === 'waiting') {
    return { state }
  }

  if (event.code) {
    return {
      state: initialScanGateState,
      outcome: { type: 'success', code: event.code },
    }
  }

  if (state.attemptsRemaining <= 1) {
    return {
      state: initialScanGateState,
      outcome: { type: 'failure' },
    }
  }

  return {
    state: {
      value: 'scanning',
      attemptsRemaining: state.attemptsRemaining - 1,
    },
  }
}
