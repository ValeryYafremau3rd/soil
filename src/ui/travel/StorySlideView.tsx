import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import './story.css'

/** Shared illustrated narration and navigation used by opening and ending sequences. */
interface StorySlideViewProps {
  slide: { title: string; text: string; image: string }
  index: number
  count: number
  fadeMs: number
  labels: { backLabel: string; nextLabel: string; finishLabel: string }
  onBack(): void
  onNext(): void
}

/**
 * Present one full-screen illustrated slide and focus its advance action on each transition.
 * @param {StorySlideViewProps} props - Current narration, ordering, labels and navigation actions.
 * @returns {import('react').ReactElement} Accessible slide matching the opening story layout.
 */
export function StorySlideView({
  slide, index, count, fadeMs, labels, onBack, onNext,
}: StorySlideViewProps) {
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => { button.current?.focus() }, [index])

  return <section className="story-overlay" role="dialog" aria-modal="true"
    aria-labelledby="story-title" style={{ '--story-fade': `${fadeMs}ms` } as CSSProperties}>
    <article key={index} className={`story-slide${index === 0 ? ' story-slide--opening' : ''}`}>
      <img src={`${import.meta.env.BASE_URL}${slide.image}`} alt={slide.title} />
      <h1 id="story-title" className="story-title">{slide.title}</h1>
      <span className="story-counter" aria-label="Slide number">{index + 1} / {count}</span>
      <div className="story-footer">
        <div className="story-caption" aria-live="polite"><p>{slide.text}</p></div>
        <div className="story-actions">
          <button type="button" onClick={onBack} disabled={index === 0}>
            {labels.backLabel}
          </button>
          <button ref={button} type="button" onClick={onNext}>
            {index === count - 1 ? labels.finishLabel : labels.nextLabel}
          </button>
        </div>
      </div>
    </article>
  </section>
}
