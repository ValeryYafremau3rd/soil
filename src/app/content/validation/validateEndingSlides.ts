import type { StoryConfig } from '../../../domain/quests/story'
import type { ContentContext } from './context'
import { reference, requireCondition, unique } from './assertions.ts'

/**
 * Validate ending narration fallbacks and references to playable outcomes.
 * @param {StoryConfig} story - Story configuration containing the ending slides and decisions.
 * @param {ContentContext} context - NPC registry used to check disappearance conditions.
 * @returns {void} Throws when a narration variant or gameplay condition is invalid.
 */
export function validateEndingSlides(story: StoryConfig, context: ContentContext): void {
  const slides = story.endingSlides.slides
  unique(slides.map(slide => slide.id), 'story.json.endingSlides.slides')
  requireCondition(slides.length === 12, 'story.json.endingSlides: requires twelve slides')
  for (const slide of slides) {
    const path = `story.json.endingSlides.${slide.id}`
    reference(slide.variants, slide.defaultVariant, `${path}.defaultVariant`)
    for (const rule of slide.rules) {
      reference(slide.variants, rule.variant, `${path}.rules.variant`)
      requireCondition(Object.keys(rule.when).length > 0, `${path}: empty ending condition`)
      if (rule.when.absentNpcId) reference(context.npcs, rule.when.absentNpcId, path)
      const decision = rule.when.decision
      if (decision) requireCondition(story.decisions.some(entry => entry.id === decision.id
        && entry.options.some(option => option.value === decision.value)),
      `${path}: unknown ending decision or option`)
    }
  }
}
