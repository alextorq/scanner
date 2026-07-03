export type CameraErrorReason =
  | 'permission-denied'
  | 'camera-not-found'
  | 'camera-busy'
  | 'insecure-context'
  | 'unsupported'
  | 'unknown'

export type CameraState =
  | { value: 'closed' }
  | { value: 'requesting-permission' }
  | { value: 'starting-camera' }
  | { value: 'active' }
  | { value: 'error'; reason: CameraErrorReason }

export type CameraEvent =
  | { type: 'OPEN' }
  | { type: 'STREAM_RECEIVED' }
  | { type: 'VIDEO_STARTED' }
  | { type: 'FAILED'; reason: CameraErrorReason }
  | { type: 'CLOSE' }

export const initialCameraState: CameraState = { value: 'closed' }

/** Чистый переход автомата камеры. Побочные эффекты выполняются снаружи. */
export function transitionCamera(state: CameraState, event: CameraEvent): CameraState {
  if (event.type === 'CLOSE') {
    return initialCameraState
  }

  if (event.type === 'FAILED') {
    return { value: 'error', reason: event.reason }
  }

  switch (state.value) {
    case 'closed':
    case 'error':
      return event.type === 'OPEN' ? { value: 'requesting-permission' } : state
    case 'requesting-permission':
      return event.type === 'STREAM_RECEIVED' ? { value: 'starting-camera' } : state
    case 'starting-camera':
      return event.type === 'VIDEO_STARTED' ? { value: 'active' } : state
    case 'active':
      return state
  }
}

export function mapCameraError(error: unknown, secureContext: boolean): CameraErrorReason {
  if (!secureContext) {
    return 'insecure-context'
  }

  if (!(error instanceof DOMException)) {
    return 'unknown'
  }

  switch (error.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'permission-denied'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'camera-not-found'
    case 'NotReadableError':
    case 'AbortError':
      return 'camera-busy'
    case 'TypeError':
      return 'unsupported'
    default:
      return 'unknown'
  }
}
