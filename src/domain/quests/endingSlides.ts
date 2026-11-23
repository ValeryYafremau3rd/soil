import type { StoryState } from './story'

/** Reachable gameplay conditions used to choose an ending narration. */
export interface EndingCondition {
  route?: 'illegal' | 'official'
  absentNpcId?: string
  decision?: { id: string; value: string }
}

/** Authored slide with one fallback and ordered, reachable outcome rules. */
export interface EndingSlide {
  id: string
  title: string
  defaultVariant: string
  variants: Readonly<Record<string, string>>
  rules: readonly { variant: string; when: EndingCondition }[]
}

/** Shared ending artwork, navigation labels and ordered narrative content. */
export interface EndingSlidesConfig {
  images: readonly string[]
  fadeMs: number
  nextLabel: string
  backLabel: string
  finishLabel: string
  slides: readonly EndingSlide[]
}

/**
 * Match actual saved outcomes without inferring death or future consequences from absence.
 * @param {EndingCondition} condition - Authored route, decision and absence requirements.
 * @param {StoryState} state - Final immutable narrative snapshot.
 * @returns {boolean} Whether every supplied requirement holds at departure.
 */
function matchesEnding(condition: EndingCondition, state: StoryState): boolean {
  return (!condition.route || state.flags.ending_route === condition.route)
    && (!condition.absentNpcId || state.absentNpcIds.includes(condition.absentNpcId))
    && (!condition.decision
      || state.decisions[condition.decision.id] === condition.decision.value)
}

/**
 * Resolve exactly one narration per slide before the ending begins.
 * @param {EndingSlidesConfig} config - Ordered narration, artwork and selection rules.
 * @param {StoryState} state - Final state captured when leaving the district.
 * @returns {{ id: string; title: string; image: string; text: string }[]} Display-ready slides.
 */
export function resolveEndingSlides(config: EndingSlidesConfig, state: StoryState) {
  return config.slides.map((slide, index) => {
    const variant = slide.rules.find(rule => matchesEnding(rule.when, state))?.variant
      ?? slide.defaultVariant

    return { id: slide.id, title: slide.title, image: config.images[index % config.images.length],
      text: slide.variants[variant] }
  })
}
