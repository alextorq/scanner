import { describe, expect, it, vi } from 'vitest'
import { ScannerEngine } from '../core/scanner-engine'
import type { BarcodeDecoder, DetectedCode, PixelFrame } from '../domain/scanner.types'

const frame: PixelFrame = {
  data: new Uint8ClampedArray(16),
  width: 2,
  height: 2,
}

const code: DetectedCode = {
  value: 'товар-42',
  format: 'QRCode',
  symbology: 'QRCode',
  position: {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 1, y: 0 },
    bottomLeft: { x: 0, y: 1 },
    bottomRight: { x: 1, y: 1 },
  },
}

function createDecoder(decode: BarcodeDecoder['decode']): BarcodeDecoder {
  return { decode, dispose: vi.fn() }
}

describe('движок сканера', () => {
  it('анализирует кадр постоянно, но не выдаёт результат без нажатия', async () => {
    const onDetected = vi.fn()
    const onScan = vi.fn()
    const decoder = createDecoder(vi.fn().mockResolvedValue([code]))
    const engine = new ScannerEngine(decoder, {
      onDetected,
      onScan,
      onError: vi.fn(),
    })

    await engine.analyze(frame, 0)

    expect(onDetected).toHaveBeenCalledWith(code)
    expect(onScan).not.toHaveBeenCalled()
  })

  it('после нажатия выдаёт ровно один результат', async () => {
    const onScan = vi.fn()
    const decoder = createDecoder(vi.fn().mockResolvedValue([code]))
    const engine = new ScannerEngine(decoder, {
      onDetected: vi.fn(),
      onScan,
      onError: vi.fn(),
    }, { analysisIntervalMs: 100 }, () => new Date('2026-07-03T10:20:30.000Z'))

    engine.arm()
    await engine.analyze(frame, 0)
    await engine.analyze(frame, 100)

    expect(onScan).toHaveBeenCalledTimes(1)
    expect(onScan).toHaveBeenCalledWith({
      value: 'товар-42',
      format: 'QRCode',
      scannedAt: '2026-07-03T10:20:30.000Z',
    })
    expect(engine.isArmed).toBe(false)
  })

  it('не запускает параллельные декодирования', async () => {
    let finishDecoding: ((codes: DetectedCode[]) => void) | undefined
    const decode = vi.fn(() => new Promise<DetectedCode[]>((resolve) => {
      finishDecoding = resolve
    }))
    const engine = new ScannerEngine(createDecoder(decode), {
      onDetected: vi.fn(),
      onScan: vi.fn(),
      onError: vi.fn(),
    }, { analysisIntervalMs: 0 })

    const first = engine.analyze(frame, 0)
    const second = engine.analyze(frame, 1)
    finishDecoding?.([])
    await Promise.all([first, second])

    expect(decode).toHaveBeenCalledTimes(1)
  })

  it('ограничивает частоту анализа кадров', async () => {
    const decode = vi.fn().mockResolvedValue([])
    const engine = new ScannerEngine(createDecoder(decode), {
      onDetected: vi.fn(),
      onScan: vi.fn(),
      onError: vi.fn(),
    }, { analysisIntervalMs: 160 })

    await engine.analyze(frame, 0)
    await engine.analyze(frame, 100)
    await engine.analyze(frame, 160)

    expect(decode).toHaveBeenCalledTimes(2)
  })

  it('передаёт ошибку декодера и продолжает работу', async () => {
    const onError = vi.fn()
    const decode = vi.fn()
      .mockRejectedValueOnce(new Error('сбой'))
      .mockResolvedValueOnce([code])
    const onDetected = vi.fn()
    const engine = new ScannerEngine(createDecoder(decode), {
      onDetected,
      onScan: vi.fn(),
      onError,
    }, { analysisIntervalMs: 0 })

    await engine.analyze(frame, 0)
    await engine.analyze(frame, 1)

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onDetected).toHaveBeenCalledWith(code)
  })
})
