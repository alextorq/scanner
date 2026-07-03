export class ScannerAudioFeedback {
  private context: AudioContext | null = null

  constructor(
    private readonly createContext: () => AudioContext = () => new AudioContext({
      latencyHint: 'interactive',
    }),
  ) {}

  prepare(): Promise<boolean> {
    const context = this.getContext()
    this.playUnlockBuffer(context)
    return this.ensureRunning(context)
  }

  success(): void {
    void this.playTone(660, 990, 0.13, 'sine', 0.11)
  }

  failure(): void {
    void this.playTone(240, 150, 0.16, 'square', 0.055)
  }

  dispose(): void {
    if (this.context && this.context.state !== 'closed') {
      void this.context.close()
    }
    this.context = null
  }

  private getContext(): AudioContext {
    this.context ??= this.createContext()
    return this.context
  }

  private playUnlockBuffer(context: AudioContext): void {
    const buffer = context.createBuffer(1, 1, context.sampleRate)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.start()
  }

  private async ensureRunning(context: AudioContext): Promise<boolean> {
    if (this.isRunning(context)) {
      return true
    }

    if (context.state === 'closed') {
      return false
    }

    try {
      await context.resume()
    } catch {
      return false
    }

    return this.isRunning(context)
  }

  private isRunning(context: AudioContext): boolean {
    return context.state === 'running'
  }

  private async playTone(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ): Promise<void> {
    const context = this.getContext()
    if (!await this.ensureRunning(context)) {
      return
    }

    const start = context.currentTime + 0.005
    const end = start + duration
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(startFrequency, start)
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, end)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(start)
    oscillator.stop(end)
  }
}
