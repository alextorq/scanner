import type { BarcodeDecoder, DetectedCode, PixelFrame } from '../domain/scanner.types'

interface WorkerResponse {
  requestId: number
  codes?: DetectedCode[]
  error?: string
}

interface PendingRequest {
  resolve: (codes: DetectedCode[]) => void
  reject: (error: Error) => void
}

export class WorkerBarcodeDecoder implements BarcodeDecoder {
  private readonly worker: Worker
  private readonly pending = new Map<number, PendingRequest>()
  private nextRequestId = 1
  private disposed = false

  constructor() {
    this.worker = new Worker(new URL('../workers/barcode-decoder.worker.ts', import.meta.url), {
      type: 'module',
      name: 'barcode-decoder',
    })
    this.worker.addEventListener('message', this.handleMessage)
    this.worker.addEventListener('error', this.handleWorkerError)
  }

  decode(frame: PixelFrame): Promise<DetectedCode[]> {
    if (this.disposed) {
      return Promise.reject(new Error('Декодер уже остановлен'))
    }

    const requestId = this.nextRequestId++

    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.worker.postMessage(
        { requestId, frame },
        [frame.data.buffer],
      )
    })
  }

  dispose(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true
    this.worker.terminate()
    const error = new Error('Декодер остановлен')
    for (const request of this.pending.values()) {
      request.reject(error)
    }
    this.pending.clear()
  }

  private readonly handleMessage = (event: MessageEvent<WorkerResponse>): void => {
    const request = this.pending.get(event.data.requestId)
    if (!request) {
      return
    }

    this.pending.delete(event.data.requestId)
    if (event.data.error) {
      request.reject(new Error(event.data.error))
      return
    }

    request.resolve(event.data.codes ?? [])
  }

  private readonly handleWorkerError = (event: ErrorEvent): void => {
    const error = new Error(event.message || 'Ошибка рабочего потока декодера')
    for (const request of this.pending.values()) {
      request.reject(error)
    }
    this.pending.clear()
  }
}
