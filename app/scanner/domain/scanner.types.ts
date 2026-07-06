export interface Point {
  x: number
  y: number
}

export interface CodePosition {
  topLeft: Point
  topRight: Point
  bottomLeft: Point
  bottomRight: Point
}

export interface DetectedCode {
  value: string
  format: string
  symbology: string
  position: CodePosition
}

export interface ScanResult {
  value: string
  format: string
  scannedAt: string
}

export interface PixelFrame {
  data: Uint8ClampedArray
  width: number
  height: number
  originX?: number
  originY?: number
}

export interface BarcodeDecoder {
  decode(frame: PixelFrame): Promise<DetectedCode[]>
  dispose(): void
}

export interface ScannerConfiguration {
  analysisIntervalMs: number
  scanAttempts: number
}

export const DEFAULT_SCANNER_CONFIGURATION: ScannerConfiguration = {
  analysisIntervalMs: 110,
  scanAttempts: 6,
}

/**
 * Метаформат AllReadable включает все форматы, которые текущая версия ZXing
 * умеет читать. Для ограничения набора достаточно передать другой массив.
 */
export const DEFAULT_BARCODE_FORMATS = ['AllReadable'] as const
