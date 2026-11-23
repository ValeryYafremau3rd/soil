import { useEffect } from 'react'
import type { TravelController } from '../../app/contracts/travel'

/**
 * Map horizontal arrow keys to story actions while the opening overlay is visible.
 * @param {TravelController} travel - Service that owns slide bounds and completion.
 * @param {boolean} active - Whether the story currently owns keyboard navigation.
 * @returns {void} Removes its listener when the story closes or the session changes.
 */
export function useStoryNavigation(
  travel: Pick<TravelController, 'previousStorySlide' | 'nextStorySlide'>,
  active: boolean
): void {
  useEffect(() => {
    if (!active) return

    /**
     * Consume story navigation before underlying game and menu listeners receive it.
     * @param {KeyboardEvent} event - Browser key press; held-key repeats are ignored.
     * @returns {void} Advances or revisits one slide for each horizontal arrow press.
     */
    const navigate = (event: KeyboardEvent): void => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.repeat) return

      if (event.key === 'ArrowLeft') travel.previousStorySlide()
      else travel.nextStorySlide()
    }
    window.addEventListener('keydown', navigate, true)
    return () => window.removeEventListener('keydown', navigate, true)
  }, [travel, active])
}
