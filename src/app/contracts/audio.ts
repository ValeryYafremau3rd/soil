/**
 * Authored sound asset path and playback volume.
 */
export interface AudioTrack {
  path: string
  volume: number
}
/**
 * Resolved track gains used to mix gameplay audio layers.
 */
export interface AudioMix {
  track: string
  outside: number
  inside: number
}
/**
 * Authored audio assets, event cues and contextual soundtrack configuration.
 */
export interface AudioConfig {
  running: string
  masterVolume: number
  tracks: Record<string, AudioTrack>
  events: Record<string, string>
  music: {
    loading: string
    ending: string
    daytime: string[]
    night: string[]
  }
  pursuit: {
    human: string
    monster: string
  }
  spotted: Record<string, string>
  locations: Record<string, AudioMix[]>
  nightAmbient: AudioMix[]
}
/**
 * Platform playback capabilities required by the audio service.
 */
export interface AudioPlayback {
  /** Stop active one-shot effects without interrupting music loops. */
  stopEffects(): void
  setMuted?(muted: boolean): void
  play(track: string, volume: number): void
  mix(tracks: ReadonlyMap<string, number>): void
  dispose(): void
}
/**
 * Typed audio actions and queries exposed across application layers.
 */
export interface AudioController {
  subscribe(listener: () => void): () => void
  getSnapshot(): boolean
  toggleSound(): void
  attach(playback: AudioPlayback, services: import('./game').GameServices): () => void
  setSetup(setup: boolean): void
  setRunning(running: boolean): void
  cue(event: string): void
  setWorld(inside: boolean, pursuit: 'human' | 'monster' | null): void
  spotted(type: string): void
}
