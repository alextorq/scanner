import { describe, expect, it, vi } from 'vitest'
import { ScannerAudioFeedback } from '../infrastructure/scanner-audio-feedback'

function createAudioContextMock(initialState: AudioContextState = 'suspended') {
  let state = initialState
  const unlockSource = {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
  }
  const oscillator = {
    type: 'sine',
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
  const gain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }
  const context = {
    get state() {
      return state
    },
    currentTime: 1,
    sampleRate: 48000,
    destination: {},
    createBuffer: vi.fn(() => ({})),
    createBufferSource: vi.fn(() => unlockSource),
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
    resume: vi.fn(async () => {
      state = 'running'
    }),
    close: vi.fn(async () => {
      state = 'closed'
    }),
  } as unknown as AudioContext

  return { context, unlockSource, oscillator }
}

describe('звуковая обратная связь сканера', () => {
  it('разблокирует контекст внутри пользовательского действия', async () => {
    const { context, unlockSource } = createAudioContextMock()
    const feedback = new ScannerAudioFeedback(() => context)

    const prepared = await feedback.prepare()

    expect(context.createBuffer).toHaveBeenCalledWith(1, 1, 48000)
    expect(unlockSource.connect).toHaveBeenCalledWith(context.destination)
    expect(unlockSource.start).toHaveBeenCalledTimes(1)
    expect(context.resume).toHaveBeenCalledTimes(1)
    expect(prepared).toBe(true)
  })

  it('ожидает активный контекст перед положительным сигналом', async () => {
    const { context, oscillator } = createAudioContextMock()
    const feedback = new ScannerAudioFeedback(() => context)

    feedback.success()
    await Promise.resolve()
    await Promise.resolve()

    expect(context.resume).toHaveBeenCalledTimes(1)
    expect(oscillator.start).toHaveBeenCalledTimes(1)
    expect(oscillator.stop).toHaveBeenCalledTimes(1)
  })
})
