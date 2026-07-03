import { computed, nextTick, onBeforeUnmount, ref, shallowRef, type Ref } from 'vue'
import { calculateCoverCrop, fitWithin } from '../scanner/core/frame-geometry'
import { ScannerEngine } from '../scanner/core/scanner-engine'
import {
  initialCameraState,
  mapCameraError,
  transitionCamera,
  type CameraErrorReason,
  type CameraState,
} from '../scanner/domain/camera-machine'
import type { DetectedCode, ScanResult } from '../scanner/domain/scanner.types'
import { ScannerAudioFeedback } from '../scanner/infrastructure/scanner-audio-feedback'
import { WorkerBarcodeDecoder } from '../scanner/infrastructure/worker-decoder'

const MAX_FRAME_EDGE = 1024

const CAMERA_ERRORS: Record<CameraErrorReason, string> = {
  'permission-denied': 'Доступ к камере запрещён. Разрешите его в настройках браузера.',
  'camera-not-found': 'Камера не найдена на этом устройстве.',
  'camera-busy': 'Камера занята другим приложением.',
  'insecure-context': 'Камера доступна только через HTTPS или на localhost.',
  'unsupported': 'Этот браузер не предоставляет доступ к камере.',
  'unknown': 'Не удалось запустить камеру. Попробуйте ещё раз.',
}

export interface CameraScannerApi {
  video: Ref<HTMLVideoElement | null>
  canvas: Ref<HTMLCanvasElement | null>
  state: Ref<CameraState>
  isPanelOpen: Ref<boolean>
  isActive: Ref<boolean>
  isArmed: Ref<boolean>
  detectedCode: Ref<DetectedCode | null>
  cameraError: Ref<string>
  analysisError: Ref<string>
  toggle(): void
  retry(): void
  scan(): void
  close(): void
}

export function useCameraScanner(onScan: (result: ScanResult) => void): CameraScannerApi {
  const video = ref<HTMLVideoElement | null>(null)
  const canvas = ref<HTMLCanvasElement | null>(null)
  const state = shallowRef<CameraState>(initialCameraState)
  const isArmed = ref(false)
  const detectedCode = shallowRef<DetectedCode | null>(null)
  const analysisError = ref('')
  const feedback = new ScannerAudioFeedback()

  let stream: MediaStream | null = null
  let engine: ScannerEngine | null = null
  let animationFrameId = 0
  let operationId = 0

  const isPanelOpen = computed(() => state.value.value !== 'closed')
  const isActive = computed(() => state.value.value === 'active')
  const cameraError = computed(() => (
    state.value.value === 'error' ? CAMERA_ERRORS[state.value.reason] : ''
  ))

  function send(event: Parameters<typeof transitionCamera>[1]): void {
    state.value = transitionCamera(state.value, event)
  }

  async function open(): Promise<void> {
    if (state.value.value !== 'closed') {
      return
    }

    const currentOperation = ++operationId
    send({ type: 'OPEN' })
    analysisError.value = ''
    detectedCode.value = null

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        send({ type: 'FAILED', reason: 'unsupported' })
        return
      }

      if (!window.isSecureContext) {
        send({ type: 'FAILED', reason: 'insecure-context' })
        return
      }

      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })

      if (currentOperation !== operationId) {
        stopTracks(nextStream)
        return
      }

      stream = nextStream
      send({ type: 'STREAM_RECEIVED' })
      await nextTick()

      const videoElement = video.value
      if (!videoElement) {
        throw new Error('Видеоэлемент не создан')
      }

      videoElement.srcObject = stream
      await videoElement.play()

      if (currentOperation !== operationId) {
        return
      }

      engine = createEngine(onScan)
      send({ type: 'VIDEO_STARTED' })
      animationFrameId = requestAnimationFrame(renderFrame)
    } catch (error) {
      if (currentOperation !== operationId) {
        return
      }

      releaseResources()
      send({ type: 'FAILED', reason: mapCameraError(error, window.isSecureContext) })
    }
  }

  function createEngine(emitScan: (result: ScanResult) => void): ScannerEngine {
    return new ScannerEngine(new WorkerBarcodeDecoder(), {
      onDetected: (code) => {
        detectedCode.value = code
      },
      onScan: (result) => {
        isArmed.value = false
        feedback.success()
        emitScan(result)
      },
      onScanFailed: () => {
        isArmed.value = false
        feedback.failure()
      },
      onError: (error) => {
        analysisError.value = error instanceof Error
          ? error.message
          : 'Не удалось проанализировать кадр'
      },
    })
  }

  function renderFrame(timestamp: number): void {
    const videoElement = video.value
    const canvasElement = canvas.value
    const currentEngine = engine

    if (!videoElement || !canvasElement || !currentEngine || state.value.value !== 'active') {
      return
    }

    const context = canvasElement.getContext('2d', { willReadFrequently: true })
    if (
      context
      && videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      && videoElement.videoWidth > 0
      && videoElement.videoHeight > 0
    ) {
      const target = {
        width: Math.max(1, canvasElement.clientWidth),
        height: Math.max(1, canvasElement.clientHeight),
      }
      const crop = calculateCoverCrop(
        { width: videoElement.videoWidth, height: videoElement.videoHeight },
        target,
      )
      const output = fitWithin({ width: crop.width, height: crop.height }, MAX_FRAME_EDGE)

      if (canvasElement.width !== output.width || canvasElement.height !== output.height) {
        canvasElement.width = output.width
        canvasElement.height = output.height
      }

      context.drawImage(
        videoElement,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        output.width,
        output.height,
      )

      if (currentEngine.canAcceptFrame(timestamp)) {
        const frame = context.getImageData(0, 0, output.width, output.height)
        void currentEngine.analyze(frame, timestamp)
      }
    }

    animationFrameId = requestAnimationFrame(renderFrame)
  }

  function scan(): void {
    if (!engine || state.value.value !== 'active') {
      return
    }

    feedback.prepare()
    engine.arm()
    isArmed.value = true
  }

  function close(): void {
    operationId += 1
    releaseResources()
    detectedCode.value = null
    analysisError.value = ''
    isArmed.value = false
    send({ type: 'CLOSE' })
  }

  function retry(): void {
    close()
    void open()
  }

  function toggle(): void {
    if (state.value.value === 'closed') {
      void open()
      return
    }

    close()
  }

  function releaseResources(): void {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = 0
    engine?.dispose()
    engine = null

    const videoElement = video.value
    if (videoElement) {
      videoElement.pause()
      videoElement.srcObject = null
    }

    if (stream) {
      stopTracks(stream)
      stream = null
    }
  }

  onBeforeUnmount(() => {
    close()
    feedback.dispose()
  })

  return {
    video,
    canvas,
    state,
    isPanelOpen,
    isActive,
    isArmed,
    detectedCode,
    cameraError,
    analysisError,
    toggle,
    retry,
    scan,
    close,
  }
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop()
  }
}
