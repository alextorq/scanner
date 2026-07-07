import { defineComponent, ref } from 'vue'
import CameraScanner from './components/CameraScanner'
import type { ScanResult } from './scanner/domain/scanner.types'

export default defineComponent({
  name: 'ScannerApp',
  setup() {
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

    return () => (
      <div class="app-shell">
        <header class="page-header">
          <div class="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p class="eyebrow">Мобильный терминал</p>
          <h1>Сканер товаров</h1>
          <p class="intro">
            Наведите камеру на код и нажмите кнопку сканирования, как на складском терминале.
          </p>
        </header>

        <main class="scan-log" aria-live="polite">
          <div class="section-heading">
            <h2>История сканирования</h2>
            <span class="counter">{scans.value.length}</span>
          </div>

          {scans.value.length === 0
            ? (
                <div class="empty-state">
                  <div class="empty-icon" aria-hidden="true">
                    <span />
                  </div>
                  <p>Здесь появятся считанные коды</p>
                  <span>Каждое нажатие добавляет одну запись</span>
                </div>
              )
            : (
                <ol class="scan-list">
                  {scans.value.map((scan, index) => (
                    <li key={`${scan.scannedAt}-${index}`} class="scan-card">
                      <div class="scan-card__topline">
                        <span class="format-badge">{scan.format}</span>
                        <time datetime={scan.scannedAt}>{formatTime(scan.scannedAt)}</time>
                      </div>
                      <p>{scan.value}</p>
                    </li>
                  ))}
                </ol>
              )}
        </main>

        <CameraScanner onScan={addScan} />
      </div>
    )
  },
})
