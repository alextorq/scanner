import {
  prepareZXingModule,
  readBarcodes,
  type ReaderOptions,
  type ReadResult,
} from 'zxing-wasm/reader'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { DEFAULT_BARCODE_FORMATS, type DetectedCode, type PixelFrame } from '../domain/scanner.types'

interface DecodeRequest {
  requestId: number
  frame: PixelFrame
}

interface DecodeResponse {
  requestId: number
  codes?: DetectedCode[]
  error?: string
}

const options: ReaderOptions = {
  formats: [...DEFAULT_BARCODE_FORMATS],
  maxNumberOfSymbols: 0,
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  returnErrors: false,
  textMode: 'Plain',
}

const moduleReady = prepareZXingModule({
  overrides: {
    locateFile: (path: string) => path.endsWith('.wasm') ? wasmUrl : path,
  },
  fireImmediately: true,
})

self.addEventListener('message', (event: MessageEvent<DecodeRequest>) => {
  void decode(event.data)
})

async function decode(request: DecodeRequest): Promise<void> {
  const response: DecodeResponse = { requestId: request.requestId }

  try {
    await moduleReady
    const results = await readBarcodes(request.frame as ImageData, options)
    response.codes = results.filter(result => result.isValid).map(mapResult)
  } catch (error) {
    response.error = error instanceof Error ? error.message : 'Неизвестная ошибка декодирования'
  }

  self.postMessage(response)
}

function mapResult(result: ReadResult): DetectedCode {
  return {
    value: result.text,
    format: result.format,
    symbology: result.symbology,
    position: result.position,
  }
}
