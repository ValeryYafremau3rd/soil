import { useSyncExternalStore } from 'react'
import type { TravelController } from '../../app/contracts/travel'
import { UI_CONFIG } from '../../content/ui'
import { useStoryNavigation } from './useStoryNavigation'
import { StorySlideView } from './StorySlideView'

/**
 * Present the opening story while the travel service keeps gameplay paused.
 * @param {{ travel: TravelController }} props - Observable travel state and story actions.
 * @returns {Element | null} Current illustrated slide, or nothing before/after the story.
 */
export function StorySlides({ travel }: { travel: TravelController }) {
  const { storySlide } = useSyncExternalStore(travel.subscribe, travel.getSnapshot)
  useStoryNavigation(travel, storySlide !== null)
  if (storySlide === null) return null

  const config = UI_CONFIG.story
  const slide = config.slides[storySlide]
  return <StorySlideView slide={slide} index={storySlide} count={config.slides.length}
    fadeMs={config.fadeMs} labels={config} onBack={travel.previousStorySlide}
    onNext={travel.nextStorySlide} />
}
