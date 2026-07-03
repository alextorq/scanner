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
  onDetected(code: DetectedCode): void
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

  constructor(
    private readonly decoder: BarcodeDecoder,
    private readonly callbacks: ScannerEngineCallbacks,
    private readonly configuration: ScannerConfiguration = DEFAULT_SCANNER_CONFIGURATION,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get isArmed(): boolean {
    return this.gateState.value === 'scanning'
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
      && timestamp - this.lastAnalysisAt >= this.configuration.analysisIntervalMs
  }

  async analyze(frame: PixelFrame, timestamp: number): Promise<void> {
    if (!this.canAcceptFrame(timestamp)) {
      return
    }

    this.decoding = true
    this.lastAnalysisAt = timestamp
    const scanGeneration = this.scanGeneration

    try {
      const codes = await this.decoder.decode(frame)
      const code = codes[0]
      if (this.disposed) {
        return
      }

      if (code) {
        this.callbacks.onDetected(code)
      }

      this.finishScanAttempt(code, scanGeneration)
    } catch (error) {
      if (!this.disposed) {
        this.callbacks.onError(error)
        this.finishScanAttempt(undefined, scanGeneration)
      }
    } finally {
      this.decoding = false
    }
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
