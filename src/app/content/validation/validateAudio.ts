import type { AudioConfig } from '../../contracts/audio.ts'

/**
 * Validate audio against the supported rules.
 * @param {AudioConfig} config - Configuration consumed by this operation.
 * @param {readonly { id: string; }[]} locations - The locations supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function validateAudio(
  config: AudioConfig,
  locations: readonly {
    id: string
  }[]
): void {
  const references = [
    config.running,
    config.music.loading,
    config.music.ending,
    ...config.music.daytime,
    ...config.music.night,
    ...Object.values(config.events),
    ...Object.values(config.pursuit),
    ...Object.values(config.spotted),
    ...Object.values(config.locations).flat().map(mix => mix.track),
    ...config.nightAmbient.map(mix => mix.track)
  ]

  for (const track of references) if (!config.tracks[track]) throw new Error(`audio.json: unknown track ${track}`)

  for (const location of Object.keys(config.locations)) {
    if (!locations.some(entry => entry.id === location)) throw new Error(`audio.json.locations.${location}: unknown location`)
  }
}
