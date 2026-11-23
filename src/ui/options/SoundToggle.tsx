import { useSyncExternalStore } from 'react'
import type { AudioController } from '../../app/contracts/audio'
import { Button } from '../components/Button'

/**
 * Perform sound toggle.
 * @param {{ audio: AudioController }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function SoundToggle({ audio }: {
  audio: AudioController
}) {
  const enabled = useSyncExternalStore(audio.subscribe, audio.getSnapshot)

  return <Button aria-pressed={enabled} onClick={audio.toggleSound}>Sound: {enabled ? 'On' : 'Off'}</Button>
}
