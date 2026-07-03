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
  onError(error: unknown): void
}

export class ScannerEngine {
  private gateState: ScanGateState = initialScanGateState
  private decoding = false
  private disposed = false
  private lastAnalysisAt = Number.NEGATIVE_INFINITY

  constructor(
    private readonly decoder: BarcodeDecoder,
    private readonly callbacks: ScannerEngineCallbacks,
    private readonly configuration: ScannerConfiguration = DEFAULT_SCANNER_CONFIGURATION,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get isArmed(): boolean {
    return this.gateState.value === 'armed'
  }

  arm(): void {
    this.gateState = transitionScanGate(this.gateState, { type: 'TRIGGER' }).state
  }

  cancel(): void {
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

    try {
      const codes = await this.decoder.decode(frame)
      const code = codes[0]
      if (!code || this.disposed) {
        return
      }

      this.callbacks.onDetected(code)
      const transition = transitionScanGate(this.gateState, { type: 'CODE_DETECTED', code })
      this.gateState = transition.state

      if (transition.output) {
        this.callbacks.onScan({
          value: transition.output.value,
          format: transition.output.format,
          scannedAt: this.now().toISOString(),
        })
      }
    } catch (error) {
      if (!this.disposed) {
        this.callbacks.onError(error)
      }
    } finally {
      this.decoding = false
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
