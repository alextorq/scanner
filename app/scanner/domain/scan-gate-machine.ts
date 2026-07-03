import type { DetectedCode } from './scanner.types'

export type ScanGateState = { value: 'waiting' } | { value: 'armed' }

export type ScanGateEvent =
  | { type: 'TRIGGER' }
  | { type: 'CANCEL' }
  | { type: 'CODE_DETECTED'; code: DetectedCode }

export interface ScanGateTransition {
  state: ScanGateState
  output?: DetectedCode
}

export const initialScanGateState: ScanGateState = { value: 'waiting' }

/** Автомат пропускает наружу ровно одно распознавание после нажатия. */
export function transitionScanGate(
  state: ScanGateState,
  event: ScanGateEvent,
): ScanGateTransition {
  if (event.type === 'TRIGGER') {
    return { state: { value: 'armed' } }
  }

  if (event.type === 'CANCEL') {
    return { state: initialScanGateState }
  }

  if (state.value === 'armed') {
    return { state: initialScanGateState, output: event.code }
  }

  return { state }
}
