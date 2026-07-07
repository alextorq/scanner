import {
  computed,
  defineComponent,
  onBeforeUnmount,
  shallowRef,
  Teleport,
  Transition,
  watch,
  type CSSProperties,
} from 'vue'
import { useCameraScanner } from '../composables/use-camera-scanner'
import { getCodeOverlayCorners } from '../scanner/core/code-overlay-geometry'
import {
  detectedCodePositionDistance,
  interpolateDetectedCode,
} from '../scanner/core/detected-code-stabilizer'
import { FOCUS_REGION } from '../scanner/core/frame-geometry'
import type { DetectedCode, ScanResult } from '../scanner/domain/scanner.types'

const OVERLAY_ANIMATION_TIME_MS = 40
const OVERLAY_STOP_DISTANCE_PX = 0.35
const focusRegionStyle = {
  '--focus-top': `${FOCUS_REGION.y * 100}%`,
  '--focus-right': `${(1 - FOCUS_REGION.x - FOCUS_REGION.width) * 100}%`,
  '--focus-bottom': `${(1 - FOCUS_REGION.y - FOCUS_REGION.height) * 100}%`,
  '--focus-left': `${FOCUS_REGION.x * 100}%`,
} satisfies CSSProperties

export default defineComponent({
  name: 'CameraScanner',
  emits: {
    scan: (_result: ScanResult) => true,
  },
  setup(_props, { emit }) {
    const {
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
    } = useCameraScanner(result => emit('scan', result))

    const displayedCode = shallowRef<DetectedCode | null>(null)
    let overlayTarget: DetectedCode | null = null
    let overlayAnimationFrame = 0
    let lastOverlayAnimationAt = 0

    watch(detectedCode, (code) => {
      overlayTarget = code

      if (!code) {
        stopOverlayAnimation()
        displayedCode.value = null
        return
      }

      const displayed = displayedCode.value
      if (!displayed || displayed.value !== code.value || displayed.format !== code.format) {
        stopOverlayAnimation()
        displayedCode.value = code
        return
      }

      requestOverlayAnimation()
    }, { immediate: true })

    const statusText = computed(() => {
      switch (state.value.value) {
        case 'requesting-permission':
          return 'Ожидаем разрешение'
        case 'starting-camera':
          return 'Запускаем камеру'
        case 'active':
          return isArmed.value ? 'Выполняем попытки сканирования' : 'Камера анализирует кадр'
        case 'error':
          return 'Камера недоступна'
        case 'closed':
          return 'Камера выключена'
      }
    })

    const helperText = computed(() => {
      if (isArmed.value) {
        return 'Удерживайте код в рамке до короткого звукового сигнала.'
      }
      if (isActive.value) {
        return 'Анализ работает постоянно. Нажмите «Сканировать», чтобы принять один код.'
      }
      return 'Включите камеру, затем используйте кнопку сканирования.'
    })

    const detectionOverlay = computed(() => {
      const code = displayedCode.value
      const canvasElement = canvas.value

      if (!code || !canvasElement || canvasElement.width <= 0 || canvasElement.height <= 0) {
        return null
      }

      const { width, height } = canvasElement
      const corners = getCodeOverlayCorners(code, { width, height })
      const clampX = (value: number) => Math.min(width, Math.max(0, value))
      const clampY = (value: number) => Math.min(height, Math.max(0, value))
      const centerX = corners.reduce((sum, point) => sum + point.x, 0) / corners.length
      const top = Math.min(...corners.map(point => point.y))
      const bottom = Math.max(...corners.map(point => point.y))
      const placeLabelAbove = bottom > height * 0.82
      const labelY = placeLabelAbove
        ? Math.max(8, top - height * 0.025)
        : Math.min(height - 8, bottom + height * 0.025)

      return {
        viewBox: `0 0 ${width} ${height}`,
        points: corners.map(point => `${clampX(point.x)},${clampY(point.y)}`).join(' '),
        labelStyle: {
          left: `${clampX(centerX) / width * 100}%`,
          top: `${labelY / height * 100}%`,
          transform: placeLabelAbove ? 'translate(-50%, -100%)' : 'translateX(-50%)',
        } satisfies CSSProperties,
      }
    })

    function requestOverlayAnimation(): void {
      if (overlayAnimationFrame === 0) {
        overlayAnimationFrame = requestAnimationFrame(animateOverlay)
      }
    }

    function animateOverlay(timestamp: number): void {
      overlayAnimationFrame = 0
      const current = displayedCode.value
      const target = overlayTarget

      if (!current || !target) {
        lastOverlayAnimationAt = 0
        return
      }

      const elapsed = lastOverlayAnimationAt === 0
        ? 1000 / 60
        : Math.min(50, timestamp - lastOverlayAnimationAt)
      lastOverlayAnimationAt = timestamp
      const progress = 1 - Math.exp(-elapsed / OVERLAY_ANIMATION_TIME_MS)
      const next = interpolateDetectedCode(current, target, progress)

      if (detectedCodePositionDistance(next, target) <= OVERLAY_STOP_DISTANCE_PX) {
        displayedCode.value = target
        lastOverlayAnimationAt = 0
        return
      }

      displayedCode.value = next
      requestOverlayAnimation()
    }

    function stopOverlayAnimation(): void {
      cancelAnimationFrame(overlayAnimationFrame)
      overlayAnimationFrame = 0
      lastOverlayAnimationAt = 0
    }

    onBeforeUnmount(stopOverlayAnimation)

    return () => {
      const code = displayedCode.value
      const overlay = detectionOverlay.value

      return (
        <Teleport to="#teleports">
          <Transition name="scanner-panel">
            {isPanelOpen.value && (
              <section class="camera-panel" aria-label="Камера сканера">
                <header class="camera-panel__header">
                  <div>
                    <span class={{ 'live-dot': true, 'live-dot--active': isActive.value }} />
                    <span>{statusText.value}</span>
                  </div>
                  <button
                    type="button"
                    class="close-button"
                    aria-label="Закрыть камеру"
                    onClick={close}
                  >
                    <span aria-hidden="true" />
                  </button>
                </header>

                <div class={{ 'camera-viewport': true, 'camera-viewport--armed': isArmed.value }}>
                  <video ref={video} muted playsinline aria-hidden="true" />
                  <canvas ref={canvas} aria-label="Изображение с камеры" />

                  {state.value.value !== 'active' && (
                    <div class="camera-placeholder">
                      {state.value.value !== 'error'
                        ? <span class="loader" aria-hidden="true" />
                        : (
                            <>
                              <p>{cameraError.value}</p>
                              <button type="button" onClick={retry}>Попробовать снова</button>
                            </>
                          )}
                    </div>
                  )}

                  {isActive.value && (
                    <div class="target-frame" style={focusRegionStyle} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                      {isArmed.value && <span />}
                    </div>
                  )}

                  <Transition name="detection">
                    {code && overlay && isActive.value && (
                      <div class="detection-layer">
                        <svg
                          class="detection-overlay"
                          viewBox={overlay.viewBox}
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <polygon points={overlay.points} />
                        </svg>
                        <div class="detection-value" style={overlay.labelStyle}>
                          {code.value}
                        </div>
                      </div>
                    )}
                  </Transition>
                </div>

                {analysisError.value && <p class="analysis-error">{analysisError.value}</p>}
              </section>
            )}
          </Transition>

          <div class="scanner-dock">
            <div class="scanner-actions">
              <button
                type="button"
                class="camera-toggle"
                aria-expanded={isPanelOpen.value}
                onClick={toggle}
              >
                <img src="/scanner-icon.png" alt="" aria-hidden="true" />
                <span>{isPanelOpen.value ? 'Закрыть' : 'Сканер'}</span>
              </button>

              <button
                type="button"
                class={{ 'scan-trigger': true, 'scan-trigger--armed': isArmed.value }}
                disabled={!isActive.value}
                onClick={scan}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8" />
                </svg>
                <span>{isArmed.value ? 'Сканирование…' : 'Сканировать'}</span>
              </button>
            </div>
            <p>{helperText.value}</p>
          </div>
        </Teleport>
      )
    }
  },
})
