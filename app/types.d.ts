declare module '*.wasm?url' {
  const url: string
  export default url
}

interface Navigator {
  readonly audioSession?: {
    type: 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record'
  }
}
