import { initialScanGateState, transitionScanGate, type ScanGateState } from '../domain/scan-gate-machine'
import {
  DEFAULT_SCANNER_CONFIGURATION,
  type BarcodeDecoder,
  type DetectedCode,
  type PixelFrame,
  type ScanResult,
  type ScannerConfiguration,
} from '../domain/scanner.types'

export interface ScannerEngineCallbacks {
  onDetected(code: DetectedCode | null): void
  onScan(result: ScanResult): void
  onScanFailed(): void
  onError(error: unknown): void
}

export class ScannerEngine {
  private gateState: ScanGateState = initialScanGateState
  private decoding = false
  private disposed = false
  private lastAnalysisAt = Number.NEGATIVE_INFINITY
  private scanGeneration = 0
  private effectiveAnalysisIntervalMs: number
  private averageDecodeDurationMs: number | null = null

  constructor(
    private readonly decoder: BarcodeDecoder,
    private readonly callbacks: ScannerEngineCallbacks,
    private readonly configuration: ScannerConfiguration = DEFAULT_SCANNER_CONFIGURATION,
    private readonly now: () => Date = () => new Date(),
    private readonly monotonicNow: () => number = () => performance.now(),
  ) {
    this.effectiveAnalysisIntervalMs = configuration.analysisIntervalMs
  }

  get isArmed(): boolean {
    return this.gateState.value === 'scanning'
  }

  get analysisIntervalMs(): number {
    return this.effectiveAnalysisIntervalMs
  }

  arm(): void {
    this.scanGeneration += 1
    this.gateState = transitionScanGate(this.gateState, {
      type: 'TRIGGER',
      attempts: this.configuration.scanAttempts,
    }).state
  }

  cancel(): void {
    this.scanGeneration += 1
    this.gateState = transitionScanGate(this.gateState, { type: 'CANCEL' }).state
  }

  canAcceptFrame(timestamp: number): boolean {
    return !this.disposed
      && !this.decoding
      && timestamp - this.lastAnalysisAt >= this.effectiveAnalysisIntervalMs
  }

  async analyze(frame: PixelFrame, timestamp: number): Promise<void> {
    if (!this.canAcceptFrame(timestamp)) {
      return
    }

    this.decoding = true
    this.lastAnalysisAt = timestamp
    const scanGeneration = this.scanGeneration
    const decodingStartedAt = this.monotonicNow()

    try {
      const codes = await this.decoder.decode(frame)
      const code = codes[0]
      if (this.disposed) {
        return
      }

      this.callbacks.onDetected(code ?? null)

      this.finishScanAttempt(code, scanGeneration)
    } catch (error) {
      if (!this.disposed) {
        this.callbacks.onDetected(null)
        this.callbacks.onError(error)
        this.finishScanAttempt(undefined, scanGeneration)
      }
    } finally {
      this.updateAnalysisInterval(this.monotonicNow() - decodingStartedAt)
      this.decoding = false
    }
  }

  private updateAnalysisInterval(decodeDurationMs: number): void {
    if (!this.configuration.adaptiveAnalysis || !Number.isFinite(decodeDurationMs)) {
      return
    }

    const minimum = Math.max(0, this.configuration.minAnalysisIntervalMs ?? 45)
    const maximum = Math.max(minimum, this.configuration.maxAnalysisIntervalMs ?? 220)
    const targetLoad = Math.min(0.95, Math.max(0.1, this.configuration.targetDecodeLoad ?? 0.75))
    const duration = Math.max(0, decodeDurationMs)
    this.averageDecodeDurationMs = this.averageDecodeDurationMs === null
      ? duration
      : this.averageDecodeDurationMs * 0.7 + duration * 0.3
    const desiredInterval = this.averageDecodeDurationMs / targetLoad
    this.effectiveAnalysisIntervalMs = Math.min(maximum, Math.max(minimum, desiredInterval))
  }

  private finishScanAttempt(code: DetectedCode | undefined, scanGeneration: number): void {
    if (scanGeneration !== this.scanGeneration) {
      return
    }

    const transition = transitionScanGate(this.gateState, {
      type: 'ATTEMPT_FINISHED',
      ...(code ? { code } : {}),
    })
    this.gateState = transition.state

    if (transition.outcome?.type === 'success') {
      this.callbacks.onScan({
        value: transition.outcome.code.value,
        format: transition.outcome.code.format,
        scannedAt: this.now().toISOString(),
      })
    } else if (transition.outcome?.type === 'failure') {
      this.callbacks.onScanFailed()
    }
  }

  dispose(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true
    this.cancel()
    this.decoder.dispose()
  }
}
