const SAMPLE_RATE = 22050
const SILENCE_DURATION = 8
const SUCCESS_DURATION = 0.14
const FAILURE_DURATION = 0.17
const FAILURE_OFFSET = SILENCE_DURATION + 0.45
const TOTAL_DURATION = FAILURE_OFFSET + FAILURE_DURATION + 0.1
const SAFETY_PAUSE_MS = 7000

export const AUDIO_CUE_OFFSETS = {
  success: SILENCE_DURATION,
  failure: FAILURE_OFFSET,
} as const

interface AudioFeedbackDependencies {
  createAudio: () => HTMLAudioElement
  createObjectUrl: (blob: Blob) => string
  revokeObjectUrl: (url: string) => void
}

const DEFAULT_DEPENDENCIES: AudioFeedbackDependencies = {
  createAudio: () => new Audio(),
  createObjectUrl: blob => URL.createObjectURL(blob),
  revokeObjectUrl: url => URL.revokeObjectURL(url),
}

export class ScannerAudioFeedback {
  private audio: HTMLAudioElement | null = null
  private audioUrl = ''
  private preparation: Promise<boolean> | null = null
  private pauseTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly dependencies: AudioFeedbackDependencies = DEFAULT_DEPENDENCIES) {}

  prepare(): Promise<boolean> {
    const audio = this.getAudio()
    this.clearPauseTimer()
    audio.pause()
    audio.currentTime = 0

    const preparation = audio.play()
      .then(() => true)
      .catch(() => false)
    this.preparation = preparation
    this.pauseTimer = setTimeout(() => audio.pause(), SAFETY_PAUSE_MS)
    return preparation
  }

  success(): void {
    void this.playCue(AUDIO_CUE_OFFSETS.success, SUCCESS_DURATION)
  }

  failure(): void {
    void this.playCue(AUDIO_CUE_OFFSETS.failure, FAILURE_DURATION)
  }

  dispose(): void {
    this.clearPauseTimer()
    this.preparation = null

    if (this.audio) {
      this.audio.pause()
      this.audio.removeAttribute('src')
      this.audio.load()
      this.audio = null
    }

    if (this.audioUrl) {
      this.dependencies.revokeObjectUrl(this.audioUrl)
      this.audioUrl = ''
    }
  }

  private getAudio(): HTMLAudioElement {
    if (this.audio) {
      return this.audio
    }

    const audio = this.dependencies.createAudio()
    this.audioUrl = this.dependencies.createObjectUrl(createFeedbackWav())
    audio.preload = 'auto'
    audio.src = this.audioUrl
    this.audio = audio
    return audio
  }

  private async playCue(offset: number, duration: number): Promise<void> {
    const audio = this.getAudio()
    const prepared = await (this.preparation ?? Promise.resolve(false))
    if (!prepared) {
      return
    }

    this.clearPauseTimer()
    audio.currentTime = offset

    if (audio.paused) {
      try {
        await audio.play()
      } catch {
        return
      }
    }

    this.pauseTimer = setTimeout(() => audio.pause(), (duration + 0.04) * 1000)
  }

  private clearPauseTimer(): void {
    if (this.pauseTimer !== null) {
      clearTimeout(this.pauseTimer)
      this.pauseTimer = null
    }
  }
}

export function createFeedbackWav(): Blob {
  const sampleCount = Math.ceil(TOTAL_DURATION * SAMPLE_RATE)
  const bytesPerSample = 2
  const dataSize = sampleCount * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeText(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeText(view, 8, 'WAVE')
  writeText(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeText(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  writeTone(view, SILENCE_DURATION, SUCCESS_DURATION, 660, 990, 0.32)
  writeTone(view, FAILURE_OFFSET, FAILURE_DURATION, 240, 150, 0.3)
  return new Blob([buffer], { type: 'audio/wav' })
}

function writeTone(
  view: DataView,
  offset: number,
  duration: number,
  startFrequency: number,
  endFrequency: number,
  volume: number,
): void {
  const firstSample = Math.floor(offset * SAMPLE_RATE)
  const toneSamples = Math.floor(duration * SAMPLE_RATE)
  let phase = 0

  for (let index = 0; index < toneSamples; index += 1) {
    const progress = index / toneSamples
    const frequency = startFrequency + (endFrequency - startFrequency) * progress
    const envelope = Math.sin(Math.PI * progress)
    phase += 2 * Math.PI * frequency / SAMPLE_RATE
    const sample = Math.sin(phase) * envelope * volume
    view.setInt16(44 + (firstSample + index) * 2, Math.round(sample * 32767), true)
  }
}

function writeText(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}
