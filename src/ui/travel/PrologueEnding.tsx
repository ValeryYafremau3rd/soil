import { useMemo, useState } from 'react'
import type { OptionsController } from '../../app/contracts/save'
import type { MessageController } from '../../app/contracts/messages'
import type { StoryConfig, StoryState } from '../../domain/quests/story'
import { resolveEndingSlides } from '../../domain/quests/endingSlides'
import { CONTENT } from '../../content/catalogue'
import { PrologueEndingActions } from './PrologueEndingActions'
import { StorySlideView } from './StorySlideView'
import { useStoryNavigation } from './useStoryNavigation'

/**
 * Resolve the final story once, then present every epilogue before the ending actions.
 * @param {object} props - Saved final state, exit route and typed lifecycle actions.
 * @param {'illegal' | 'official'} props.route - Completed departure route.
 * @param {StoryState} props.story - Narrative snapshot captured when the prologue ends.
 * @param {OptionsController} props.options - Save, load and new-game capabilities.
 * @param {MessageController} props.messages - Persistence feedback displayed after the slides.
 * @returns {import('react').ReactElement} Ending narration or terminal lifecycle actions.
 */
export function PrologueEnding({ route, story, options, messages }: {
  route: 'illegal' | 'official'
  story: StoryState
  options: OptionsController
  messages: MessageController
}) {
  const config = (CONTENT.data.story as StoryConfig).endingSlides
  const [slides] = useState(() => resolveEndingSlides(config, story))
  const [index, setIndex] = useState(0)
  const navigation = useMemo(() => ({
    previousStorySlide: () => setIndex(current => Math.max(0, current - 1)),
    nextStorySlide: () => setIndex(current => Math.min(slides.length, current + 1)),
  }), [slides.length])
  useStoryNavigation(navigation, index < slides.length)

  return index < slides.length
    ? <StorySlideView slide={slides[index]} index={index} count={slides.length}
      fadeMs={config.fadeMs} labels={config} onBack={navigation.previousStorySlide}
      onNext={navigation.nextStorySlide} />
    : <PrologueEndingActions route={route} options={options} messages={messages} />
}
