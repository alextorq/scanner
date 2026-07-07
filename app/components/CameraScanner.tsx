import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  Teleport,
  Transition,
  watch,
  type CSSProperties,
} from 'vue'
import { useCameraScanner } from '../composables/use-camera-scanner'
import {
  CAMERA_PANEL_EDGE_GAP,
  CAMERA_PANEL_MIN_CONTROL_WIDTH,
  clampCameraPanelRect,
  getMinimumCameraPanelSizeFromFocus,
  moveCameraPanelRect,
  resizeCameraPanelRect,
  type CameraPanelConstraints,
  type CameraPanelRect,
  type CameraPanelSize,
} from '../scanner/core/camera-panel-layout'
import { getCodeOverlayCorners } from '../scanner/core/code-overlay-geometry'
import {
  detectedCodePositionDistance,
  interpolateDetectedCode,
} from '../scanner/core/detected-code-stabilizer'
import { FOCUS_REGION } from '../scanner/core/frame-geometry'
import type { DetectedCode, ScanResult } from '../scanner/domain/scanner.types'

const OVERLAY_ANIMATION_TIME_MS = 40
const OVERLAY_STOP_DISTANCE_PX = 0.35
const KEYBOARD_PANEL_STEP_PX = 16
const KEYBOARD_PANEL_FAST_STEP_PX = 48
const FALLBACK_MINIMUM_PANEL_SIZE: CameraPanelSize = {
  width: CAMERA_PANEL_MIN_CONTROL_WIDTH,
  height: 220,
}
const focusRegionStyle = {
  '--focus-top': `${FOCUS_REGION.y * 100}%`,
  '--focus-right': `${(1 - FOCUS_REGION.x - FOCUS_REGION.width) * 100}%`,
  '--focus-bottom': `${(1 - FOCUS_REGION.y - FOCUS_REGION.height) * 100}%`,
  '--focus-left': `${FOCUS_REGION.x * 100}%`,
} satisfies CSSProperties

type PanelInteraction = {
  type: 'move' | 'resize'
  pointerId: number
  startClientX: number
  startClientY: number
  startRect: CameraPanelRect
}

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

    const panel = ref<HTMLElement | null>(null)
    const panelLayout = shallowRef<CameraPanelRect | null>(null)
    const minimumFocusSize = shallowRef({
      width: CAMERA_PANEL_MIN_CONTROL_WIDTH,
      height: FALLBACK_MINIMUM_PANEL_SIZE.height,
    })
    const minimumPanelSize = shallowRef<CameraPanelSize>(FALLBACK_MINIMUM_PANEL_SIZE)
    const isDraggingPanel = ref(false)
    const isResizingPanel = ref(false)
    const displayedCode = shallowRef<DetectedCode | null>(null)
    let overlayTarget: DetectedCode | null = null
    let overlayAnimationFrame = 0
    let lastOverlayAnimationAt = 0
    let panelLayoutFrame = 0
    let panelInteraction: PanelInteraction | null = null
    let hasUserResizedPanel = false

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

    const cameraPanelStyle = computed<CSSProperties>(() => {
      const minimumSize = minimumPanelSize.value
      const layout = panelLayout.value
      const style = {
        '--camera-panel-min-width': `${minimumSize.width}px`,
        '--camera-panel-min-height': `${minimumSize.height}px`,
      } satisfies CSSProperties

      if (!layout) {
        return style
      }

      return {
        ...style,
        top: `${layout.top}px`,
        right: 'auto',
        bottom: 'auto',
        left: `${layout.left}px`,
        width: `${layout.width}px`,
        height: `${layout.height}px`,
        marginInline: '0',
      } satisfies CSSProperties
    })

    watch(isPanelOpen, (isOpen) => {
      if (!isOpen) {
        stopPanelInteraction()
        return
      }

      void nextTick(syncPanelLayout)
    }, { flush: 'post' })

    watch(analysisError, () => {
      if (isPanelOpen.value) {
        void nextTick(syncPanelLayout)
      }
    }, { flush: 'post' })

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

    function syncPanelLayout(): void {
      panelLayoutFrame = 0

      if (!isPanelOpen.value) {
        return
      }

      const element = panel.value
      if (!element) {
        return
      }

      updateMinimumPanelSize(element)
      const nextLayout = panelLayout.value ?? readPanelRect(element)
      panelLayout.value = clampCameraPanelRect(nextLayout, getPanelConstraints())
    }

    function requestPanelLayoutSync(): void {
      if (!isPanelOpen.value || panelLayoutFrame !== 0) {
        return
      }

      panelLayoutFrame = requestAnimationFrame(syncPanelLayout)
    }

    function updateMinimumPanelSize(element: HTMLElement): void {
      const viewportElement = element.querySelector<HTMLElement>('.camera-viewport')

      if (!viewportElement) {
        return
      }

      const elementRect = element.getBoundingClientRect()
      const viewportRect = viewportElement.getBoundingClientRect()
      const chromeHeight = Math.max(0, elementRect.height - viewportRect.height)

      if (!hasUserResizedPanel) {
        minimumFocusSize.value = {
          width: viewportRect.width * FOCUS_REGION.width,
          height: viewportRect.height * FOCUS_REGION.height,
        }
      }

      minimumPanelSize.value = getMinimumCameraPanelSizeFromFocus(
        minimumFocusSize.value,
        chromeHeight,
      )
    }

    function getPanelConstraints(): CameraPanelConstraints {
      return {
        viewport: {
          width: typeof window === 'undefined' ? 1 : window.innerWidth,
          height: typeof window === 'undefined' ? 1 : window.innerHeight,
        },
        minimumSize: minimumPanelSize.value,
        edgeGap: CAMERA_PANEL_EDGE_GAP,
      }
    }

    function readPanelRect(element: HTMLElement): CameraPanelRect {
      const rect = element.getBoundingClientRect()

      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }
    }

    function ensurePanelLayout(): CameraPanelRect | null {
      const element = panel.value

      if (!element) {
        return null
      }

      updateMinimumPanelSize(element)
      const nextLayout = clampCameraPanelRect(
        panelLayout.value ?? readPanelRect(element),
        getPanelConstraints(),
      )
      panelLayout.value = nextLayout

      return nextLayout
    }

    function startPanelDrag(event: PointerEvent): void {
      if (!shouldStartPanelPointerInteraction(event)) {
        return
      }

      const startRect = ensurePanelLayout()

      if (!startRect) {
        return
      }

      panelInteraction = {
        type: 'move',
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startRect,
      }
      isDraggingPanel.value = true
      capturePanelPointer(event)
      event.preventDefault()
    }

    function dragPanel(event: PointerEvent): void {
      const interaction = panelInteraction

      if (!interaction || interaction.type !== 'move' || interaction.pointerId !== event.pointerId) {
        return
      }

      panelLayout.value = moveCameraPanelRect(
        interaction.startRect,
        {
          x: event.clientX - interaction.startClientX,
          y: event.clientY - interaction.startClientY,
        },
        getPanelConstraints(),
      )
      event.preventDefault()
    }

    function startPanelResize(event: PointerEvent): void {
      if (!shouldStartPanelPointerInteraction(event, { allowInteractiveTarget: true })) {
        return
      }

      const startRect = ensurePanelLayout()

      if (!startRect) {
        return
      }

      hasUserResizedPanel = true
      panelInteraction = {
        type: 'resize',
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startRect,
      }
      isResizingPanel.value = true
      capturePanelPointer(event)
      event.preventDefault()
    }

    function resizePanel(event: PointerEvent): void {
      const interaction = panelInteraction

      if (!interaction || interaction.type !== 'resize' || interaction.pointerId !== event.pointerId) {
        return
      }

      panelLayout.value = resizeCameraPanelRect(
        interaction.startRect,
        {
          x: event.clientX - interaction.startClientX,
          y: event.clientY - interaction.startClientY,
        },
        getPanelConstraints(),
      )
      event.preventDefault()
    }

    function movePanelWithKeyboard(event: KeyboardEvent): void {
      if (event.target !== event.currentTarget) {
        return
      }

      const delta = getKeyboardDelta(event)

      if (!delta) {
        return
      }

      const startRect = ensurePanelLayout()

      if (!startRect) {
        return
      }

      panelLayout.value = moveCameraPanelRect(startRect, delta, getPanelConstraints())
      event.preventDefault()
    }

    function resizePanelWithKeyboard(event: KeyboardEvent): void {
      const delta = getKeyboardDelta(event)

      if (!delta) {
        return
      }

      const startRect = ensurePanelLayout()

      if (!startRect) {
        return
      }

      hasUserResizedPanel = true
      panelLayout.value = resizeCameraPanelRect(startRect, delta, getPanelConstraints())
      event.preventDefault()
    }

    function getKeyboardDelta(event: KeyboardEvent): { x: number, y: number } | null {
      const step = event.shiftKey ? KEYBOARD_PANEL_FAST_STEP_PX : KEYBOARD_PANEL_STEP_PX

      switch (event.key) {
        case 'ArrowLeft':
          return { x: -step, y: 0 }
        case 'ArrowRight':
          return { x: step, y: 0 }
        case 'ArrowUp':
          return { x: 0, y: -step }
        case 'ArrowDown':
          return { x: 0, y: step }
        default:
          return null
      }
    }

    function shouldStartPanelPointerInteraction(
      event: PointerEvent,
      options: { allowInteractiveTarget?: boolean } = {},
    ): boolean {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return false
      }

      if (options.allowInteractiveTarget) {
        return true
      }

      const target = event.target

      return !(target instanceof Element && target.closest('button'))
    }

    function capturePanelPointer(event: PointerEvent): void {
      if (event.currentTarget instanceof HTMLElement) {
        event.currentTarget.setPointerCapture(event.pointerId)
      }
    }

    function releasePanelPointer(event: PointerEvent): void {
      if (
        event.currentTarget instanceof HTMLElement
        && event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    }

    function finishPanelInteraction(event: PointerEvent): void {
      if (!panelInteraction || panelInteraction.pointerId !== event.pointerId) {
        return
      }

      releasePanelPointer(event)
      stopPanelInteraction()
    }

    function stopPanelInteraction(): void {
      panelInteraction = null
      isDraggingPanel.value = false
      isResizingPanel.value = false
    }

    onMounted(() => {
      window.addEventListener('resize', requestPanelLayoutSync)
    })

    onBeforeUnmount(() => {
      stopOverlayAnimation()
      stopPanelInteraction()
      cancelAnimationFrame(panelLayoutFrame)
      window.removeEventListener('resize', requestPanelLayoutSync)
    })

    return () => {
      const code = displayedCode.value
      const overlay = detectionOverlay.value

      return (
        <Teleport to="#teleports">
          <Transition name="scanner-panel">
            {isPanelOpen.value && (
              <section
                ref={panel}
                class={{
                  'camera-panel': true,
                  'camera-panel--dragging': isDraggingPanel.value,
                  'camera-panel--resizing': isResizingPanel.value,
                }}
                style={cameraPanelStyle.value}
                aria-label="Камера сканера"
              >
                <header
                  class="camera-panel__header"
                  tabindex={0}
                  aria-label="Переместить окно камеры"
                  onPointerdown={startPanelDrag}
                  onPointermove={dragPanel}
                  onPointerup={finishPanelInteraction}
                  onPointercancel={finishPanelInteraction}
                  onKeydown={movePanelWithKeyboard}
                >
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

                <button
                  type="button"
                  class="camera-resize-handle"
                  aria-label="Изменить размер окна камеры"
                  onPointerdown={startPanelResize}
                  onPointermove={resizePanel}
                  onPointerup={finishPanelInteraction}
                  onPointercancel={finishPanelInteraction}
                  onKeydown={resizePanelWithKeyboard}
                >
                  <span aria-hidden="true" />
                </button>
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
