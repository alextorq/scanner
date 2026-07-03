import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AUDIO_CUE_OFFSETS,
  createFeedbackWav,
  ScannerAudioFeedback,
} from '../infrastructure/scanner-audio-feedback'

afterEach(() => {
  vi.useRealTimers()
})

function createAudioMock() {
  let paused = true
  const audio = {
    currentTime: 0,
    preload: '',
    src: '',
    muted: true,
    volume: 0,
    get paused() {
      return paused
    },
    play: vi.fn(async () => {
      paused = false
    }),
    pause: vi.fn(() => {
      paused = true
    }),
    load: vi.fn(),
    removeAttribute: vi.fn(),
  } as unknown as HTMLAudioElement

  return audio
}

function createFeedback(audio: HTMLAudioElement) {
  const configureSession = vi.fn()
  return {
    feedback: new ScannerAudioFeedback({
      createAudio: () => audio,
      createObjectUrl: () => 'blob:scanner-sounds',
      revokeObjectUrl: vi.fn(),
      configureSession,
    }),
    configureSession,
  }
}

describe('звуковая обратная связь сканера', () => {
  it('начинает аудиопоток непосредственно при нажатии', async () => {
    const audio = createAudioMock()
    const { feedback, configureSession } = createFeedback(audio)

    const prepared = await feedback.prepare()

    expect(audio.src).toBe('blob:scanner-sounds')
    expect(audio.currentTime).toBe(0)
    expect(audio.muted).toBe(false)
    expect(audio.volume).toBe(1)
    expect(audio.load).toHaveBeenCalledTimes(1)
    expect(audio.play).toHaveBeenCalledTimes(1)
    expect(configureSession).toHaveBeenCalledTimes(1)
    expect(prepared).toBe(true)
    feedback.dispose()
  })

  it('перематывает активный поток на положительный сигнал', async () => {
    vi.useFakeTimers()
    const audio = createAudioMock()
    const { feedback } = createFeedback(audio)
    await feedback.prepare()

    feedback.success()
    await Promise.resolve()

    expect(audio.currentTime).toBe(AUDIO_CUE_OFFSETS.success)
    expect(audio.play).toHaveBeenCalledTimes(1)
    vi.runAllTimers()
    expect(audio.pause).toHaveBeenCalled()
  })

  it('перематывает активный поток на отрицательный сигнал', async () => {
    const audio = createAudioMock()
    const { feedback } = createFeedback(audio)
    await feedback.prepare()

    feedback.failure()
    await Promise.resolve()

    expect(audio.currentTime).toBe(AUDIO_CUE_OFFSETS.failure)
    feedback.dispose()
  })

  it('создаёт валидный WAV-файл со звуковыми данными', async () => {
    const wav = createFeedbackWav()
    const bytes = new Uint8Array(await wav.arrayBuffer())
    const header = new TextDecoder().decode(bytes.slice(0, 4))
    const hasAudibleSamples = bytes.slice(44).some(value => value !== 0)

    expect(wav.type).toBe('audio/wav')
    expect(header).toBe('RIFF')
    expect(hasAudibleSamples).toBe(true)
  })
})
