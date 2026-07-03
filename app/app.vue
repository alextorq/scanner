<script setup lang="ts">
import { ref } from 'vue'
import CameraScanner from './components/CameraScanner.vue'
import type { ScanResult } from './scanner/domain/scanner.types'

const scans = ref<ScanResult[]>([])

function addScan(result: ScanResult): void {
  scans.value.unshift(result)
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}
</script>

<template>
  <div class="app-shell">
    <header class="page-header">
      <div class="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p class="eyebrow">
        Мобильный терминал
      </p>
      <h1>Сканер товаров</h1>
      <p class="intro">
        Наведите камеру на код и нажмите кнопку сканирования, как на складском терминале.
      </p>
    </header>

    <main class="scan-log" aria-live="polite">
      <div class="section-heading">
        <h2>История сканирования</h2>
        <span class="counter">{{ scans.length }}</span>
      </div>

      <div v-if="scans.length === 0" class="empty-state">
        <div class="empty-icon" aria-hidden="true">
          <span />
        </div>
        <p>Здесь появятся считанные коды</p>
        <span>Каждое нажатие добавляет одну запись</span>
      </div>

      <ol v-else class="scan-list">
        <li v-for="(scan, index) in scans" :key="`${scan.scannedAt}-${index}`" class="scan-card">
          <div class="scan-card__topline">
            <span class="format-badge">{{ scan.format }}</span>
            <time :datetime="scan.scannedAt">{{ formatTime(scan.scannedAt) }}</time>
          </div>
          <p>{{ scan.value }}</p>
        </li>
      </ol>
    </main>

    <CameraScanner @scan="addScan" />
  </div>
</template>

<style scoped>
.app-shell {
  width: min(100%, 34rem);
  min-height: 100dvh;
  margin: 0 auto;
  padding: max(1.5rem, env(safe-area-inset-top)) 1.25rem 10.5rem;
}

.page-header {
  padding-top: 1.75rem;
}

.brand-mark {
  display: flex;
  align-items: flex-end;
  gap: 0.22rem;
  width: 2.65rem;
  height: 2.65rem;
  margin-bottom: 2.25rem;
  padding: 0.65rem;
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 0.9rem;
  background: var(--surface);
  box-shadow: var(--shadow-small);
}

.brand-mark span {
  width: 0.25rem;
  border-radius: 999px;
  background: currentColor;
}

.brand-mark span:nth-child(1) {
  height: 1rem;
}

.brand-mark span:nth-child(2) {
  height: 1.35rem;
}

.brand-mark span:nth-child(3) {
  height: 0.75rem;
  background: var(--accent);
}

.eyebrow {
  margin: 0 0 0.65rem;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

h1 {
  max-width: 18rem;
  margin: 0;
  font-size: clamp(2.3rem, 11vw, 3.7rem);
  line-height: 0.94;
  letter-spacing: -0.065em;
}

.intro {
  max-width: 27rem;
  margin: 1.25rem 0 0;
  color: var(--muted);
  font-size: 0.98rem;
  line-height: 1.55;
}

.scan-log {
  margin-top: 3.25rem;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.section-heading h2 {
  margin: 0;
  font-size: 1rem;
  letter-spacing: -0.025em;
}

.counter {
  display: grid;
  min-width: 1.8rem;
  height: 1.8rem;
  place-items: center;
  padding-inline: 0.45rem;
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  font-size: 0.75rem;
  font-weight: 700;
}

.empty-state {
  display: grid;
  justify-items: center;
  min-height: 12.5rem;
  align-content: center;
  padding: 2rem 1rem;
  text-align: center;
  border: 1px dashed var(--line-strong);
  border-radius: 1.4rem;
  background: rgb(255 255 255 / 42%);
}

.empty-icon {
  position: relative;
  width: 3.5rem;
  height: 3.5rem;
  margin-bottom: 1rem;
  border: 1px solid var(--line);
  border-radius: 1.1rem;
  background: var(--surface);
}

.empty-icon::before,
.empty-icon::after,
.empty-icon span::before,
.empty-icon span::after {
  position: absolute;
  width: 0.7rem;
  height: 0.7rem;
  content: '';
  border-color: var(--muted);
  border-style: solid;
}

.empty-icon::before {
  top: 0.7rem;
  left: 0.7rem;
  border-width: 1px 0 0 1px;
}

.empty-icon::after {
  top: 0.7rem;
  right: 0.7rem;
  border-width: 1px 1px 0 0;
}

.empty-icon span::before {
  bottom: 0.7rem;
  left: 0.7rem;
  border-width: 0 0 1px 1px;
}

.empty-icon span::after {
  right: 0.7rem;
  bottom: 0.7rem;
  border-width: 0 1px 1px 0;
}

.empty-state p {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
}

.empty-state > span {
  margin-top: 0.35rem;
  color: var(--muted);
  font-size: 0.78rem;
}

.scan-list {
  display: grid;
  gap: 0.7rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.scan-card {
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: 1.15rem;
  background: var(--surface);
  box-shadow: var(--shadow-small);
}

.scan-card__topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.format-badge {
  padding: 0.3rem 0.5rem;
  color: var(--accent-dark);
  border-radius: 0.4rem;
  background: var(--accent-soft);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

time {
  color: var(--muted);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
}

.scan-card p {
  overflow-wrap: anywhere;
  margin: 0.8rem 0 0;
  font-family: var(--font-mono);
  font-size: 0.91rem;
  line-height: 1.45;
}
</style>
