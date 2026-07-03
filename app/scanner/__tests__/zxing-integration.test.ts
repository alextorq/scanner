import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { prepareZXingModule, readBarcodes, writeBarcode } from 'zxing-wasm'

const wasmBinary = readFileSync(new URL(
  '../../../node_modules/zxing-wasm/dist/full/zxing_full.wasm',
  import.meta.url,
))

const moduleReady = prepareZXingModule({
  overrides: { wasmBinary },
  fireImmediately: true,
})

describe('интеграция с ZXing', () => {
  it('расшифровывает QR-код из массива RGBA-пикселей', async () => {
    await moduleReady
    const generated = await writeBarcode('СКЛАД-42', {
      format: 'QRCode',
      scale: 5,
    })
    const rgba = new Uint8ClampedArray(generated.symbol.width * generated.symbol.height * 4)

    for (let source = 0, target = 0; source < generated.symbol.data.length; source += 1, target += 4) {
      const luminance = generated.symbol.data[source] ?? 0
      rgba[target] = luminance
      rgba[target + 1] = luminance
      rgba[target + 2] = luminance
      rgba[target + 3] = 255
    }

    const results = await readBarcodes({
      data: rgba,
      width: generated.symbol.width,
      height: generated.symbol.height,
    } as ImageData, {
      formats: ['AllReadable'],
      maxNumberOfSymbols: 1,
      textMode: 'Plain',
    })

    expect(results[0]?.text).toBe('СКЛАД-42')
    expect(results[0]?.format).toBe('QRCode')
  })
})
