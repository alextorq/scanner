<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch, type CSSProperties } from 'vue'
import { useCameraScanner } from '../composables/use-camera-scanner'
import { getCodeOverlayCorners } from '../scanner/core/code-overlay-geometry'
import {
  detectedCodePositionDistance,
  interpolateDetectedCode,
} from '../scanner/core/detected-code-stabilizer'
import type { DetectedCode, ScanResult } from '../scanner/domain/scanner.types'

const OVERLAY_ANIMATION_TIME_MS = 65
const OVERLAY_STOP_DISTANCE_PX = 0.35

const emit = defineEmits<{
  scan: [result: ScanResult]
}>()

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
</script>

<template>
  <Teleport to="#teleports">
    <Transition name="scanner-panel">
      <section v-if="isPanelOpen" class="camera-panel" aria-label="Камера сканера">
        <header class="camera-panel__header">
          <div>
            <span class="live-dot" :class="{ 'live-dot--active': isActive }" />
            <span>{{ statusText }}</span>
          </div>
          <button type="button" class="close-button" aria-label="Закрыть камеру" @click="close">
            <span aria-hidden="true" />
          </button>
        </header>

        <div class="camera-viewport" :class="{ 'camera-viewport--armed': isArmed }">
          <video ref="video" muted playsinline aria-hidden="true" />
          <canvas
            ref="canvas"
            aria-label="Изображение с камеры"
          />

          <div v-if="state.value !== 'active'" class="camera-placeholder">
            <span v-if="state.value !== 'error'" class="loader" aria-hidden="true" />
            <template v-else>
              <p>{{ cameraError }}</p>
              <button type="button" @click="retry">
                Попробовать снова
              </button>
            </template>
          </div>

          <div v-if="isActive" class="target-frame" aria-hidden="true">
            <i /><i /><i /><i />
            <span v-if="isArmed" />
          </div>

          <template v-if="displayedCode && detectionOverlay && isActive">
            <svg
              class="detection-overlay"
              :viewBox="detectionOverlay.viewBox"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polygon :points="detectionOverlay.points" />
            </svg>
            <div class="detection-value" :style="detectionOverlay.labelStyle">
              {{ displayedCode.value }}
            </div>
          </template>
        </div>

        <p v-if="analysisError" class="analysis-error">
          {{ analysisError }}
        </p>
      </section>
    </Transition>

    <div class="scanner-dock">
      <div class="scanner-actions">
        <button
          type="button"
          class="camera-toggle"
          :aria-expanded="isPanelOpen"
          @click="toggle"
        >
          <img src="/scanner-icon.png" alt="" aria-hidden="true">
          <span>{{ isPanelOpen ? 'Закрыть' : 'Сканер' }}</span>
        </button>

        <button
          type="button"
          class="scan-trigger"
          :class="{ 'scan-trigger--armed': isArmed }"
          :disabled="!isActive"
          @click="scan"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8" />
          </svg>
          <span>{{ isArmed ? 'Сканирование…' : 'Сканировать' }}</span>
        </button>
      </div>
      <p>{{ helperText }}</p>
    </div>
  </Teleport>
</template>

<style scoped>
.camera-panel {
  position: fixed;
  z-index: 20;
  right: max(0.85rem, env(safe-area-inset-right));
  bottom: calc(9.7rem + env(safe-area-inset-bottom));
  left: max(0.85rem, env(safe-area-inset-left));
  width: min(calc(100% - 1.7rem), 32rem);
  margin-inline: auto;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 13%);
  border-radius: 1.45rem;
  background: #171a19;
  box-shadow: 0 1.5rem 4rem rgb(24 25 23 / 28%);
}

.camera-panel__header {
  display: flex;
  height: 3.1rem;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.8rem 0 1rem;
  color: #f7f5f0;
}

.camera-panel__header > div {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.75rem;
  font-weight: 650;
}

.live-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: #858885;
}

.live-dot--active {
  background: #7fdd9a;
  box-shadow: 0 0 0 0.22rem rgb(127 221 154 / 14%);
}

.close-button {
  position: relative;
  width: 2.2rem;
  height: 2.2rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgb(255 255 255 / 8%);
}

.close-button span::before,
.close-button span::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0.9rem;
  height: 1px;
  content: '';
  background: #f7f5f0;
}

.close-button span::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.close-button span::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.camera-viewport {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: #0d0f0e;
}

.camera-viewport video {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.camera-viewport canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.camera-placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  padding: 2rem;
  color: #d6d6d2;
  text-align: center;
  background: radial-gradient(circle at 50% 35%, #262b28, #121413 70%);
}

.camera-placeholder p {
  max-width: 20rem;
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.5;
}

.camera-placeholder button {
  margin-top: 1rem;
  padding: 0.65rem 0.9rem;
  color: #171a19;
  border: 0;
  border-radius: 0.65rem;
  background: #f7f5f0;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 750;
}

.loader {
  width: 1.7rem;
  height: 1.7rem;
  border: 2px solid rgb(255 255 255 / 14%);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.85s linear infinite;
}

.target-frame {
  position: absolute;
  inset: 18% 11%;
}

.target-frame i {
  position: absolute;
  width: 1.5rem;
  height: 1.5rem;
  border-color: rgb(255 255 255 / 83%);
  border-style: solid;
}

.target-frame i:nth-child(1) {
  top: 0;
  left: 0;
  border-width: 2px 0 0 2px;
  border-radius: 0.45rem 0 0;
}

.target-frame i:nth-child(2) {
  top: 0;
  right: 0;
  border-width: 2px 2px 0 0;
  border-radius: 0 0.45rem 0 0;
}

.target-frame i:nth-child(3) {
  right: 0;
  bottom: 0;
  border-width: 0 2px 2px 0;
  border-radius: 0 0 0.45rem;
}

.target-frame i:nth-child(4) {
  bottom: 0;
  left: 0;
  border-width: 0 0 2px 2px;
  border-radius: 0 0 0 0.45rem;
}

.target-frame > span {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 1px;
  background: var(--accent);
  box-shadow: 0 0 0.7rem var(--accent);
  animation: scan-line 1.55s ease-in-out infinite alternate;
}

.camera-viewport--armed .target-frame i {
  border-color: var(--accent);
}

.detection-overlay {
  position: absolute;
  z-index: 2;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.detection-overlay polygon {
  fill: rgb(127 221 154 / 10%);
  stroke: #7fdd9a;
  stroke-linejoin: round;
  stroke-width: 2.5;
  vector-effect: non-scaling-stroke;
  filter: drop-shadow(0 0 0.3rem rgb(127 221 154 / 65%));
}

.detection-value {
  position: absolute;
  z-index: 3;
  max-width: calc(100% - 2rem);
  overflow: hidden;
  padding: 0.4rem 0.6rem;
  color: #f7f5f0;
  border: 1px solid rgb(127 221 154 / 55%);
  border-radius: 0.55rem;
  background: rgb(15 18 16 / 84%);
  font-family: var(--font-mono);
  font-size: 0.66rem;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
  backdrop-filter: blur(0.5rem);
  pointer-events: none;
}

.analysis-error {
  margin: 0;
  padding: 0.65rem 1rem;
  color: #ffc7bc;
  background: #331c19;
  font-size: 0.7rem;
}

.scanner-dock {
  position: fixed;
  z-index: 30;
  right: 0;
  bottom: 0;
  left: 0;
  width: min(100%, 34rem);
  margin: 0 auto;
  padding: 0.75rem 1rem calc(0.8rem + env(safe-area-inset-bottom));
  background: linear-gradient(to bottom, rgb(244 241 234 / 0%), var(--page) 20%);
}

.scanner-actions {
  display: grid;
  grid-template-columns: 5.2rem 1fr;
  gap: 0.55rem;
  padding-top: 0.75rem;
}

.scanner-actions button {
  min-height: 3.55rem;
  border: 0;
  border-radius: 1rem;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 750;
  transition: transform 120ms ease, opacity 120ms ease, background 120ms ease;
}

.scanner-actions button:active:not(:disabled) {
  transform: scale(0.975);
}

.scanner-actions svg {
  width: 1.2rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.65;
}

.camera-toggle {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.25rem;
  color: var(--ink);
  border: 1px solid var(--line-strong) !important;
  background: var(--surface);
  box-shadow: var(--shadow-small);
}

.camera-toggle span {
  font-size: 0.62rem;
}

.camera-toggle img {
  width: 1.35rem;
  height: 1.35rem;
  object-fit: contain;
}

.scan-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  color: #fffaf4;
  background: var(--ink);
  box-shadow: 0 0.65rem 1.5rem rgb(25 27 25 / 20%);
}

.scan-trigger--armed {
  color: #20110e;
  background: var(--accent);
}

.scan-trigger:disabled {
  color: #a8aaa5;
  background: #deddd8;
  box-shadow: none;
}

.scanner-dock > p {
  display: flex;
  min-height: 2.7em;
  align-items: center;
  justify-content: center;
  margin: 0.55rem 0 0;
  color: var(--muted);
  font-size: 0.66rem;
  line-height: 1.35;
  text-align: center;
}

.scanner-panel-enter-active,
.scanner-panel-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.scanner-panel-enter-from,
.scanner-panel-leave-to {
  opacity: 0;
  transform: translateY(0.8rem) scale(0.98);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes scan-line {
  from { top: 0; }
  to { top: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .loader,
  .target-frame > span {
    animation: none;
  }
}
</style>
