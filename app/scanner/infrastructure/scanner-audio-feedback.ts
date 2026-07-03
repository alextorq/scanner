export class ScannerAudioFeedback {
  private context: AudioContext | null = null

  prepare(): void {
    const context = this.getContext()
    if (context.state === 'suspended') {
      void context.resume()
    }
  }

  success(): void {
    this.playTone(660, 990, 0.13, 'sine', 0.11)
  }

  failure(): void {
    this.playTone(240, 150, 0.16, 'square', 0.055)
  }

  dispose(): void {
    if (this.context && this.context.state !== 'closed') {
      void this.context.close()
    }
    this.context = null
  }

  private getContext(): AudioContext {
    this.context ??= new AudioContext()
    return this.context
  }

  private playTone(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ): void {
    const context = this.getContext()
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
