import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync } from 'node:fs'
import { content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'

test('ending narration references existing artwork and valid gameplay conditions', () => {
  const data = content()
  validateContent(data)
  for (const image of data.story.endingSlides.images) {
    assert.ok(existsSync(new URL(`../../public/${image}`, import.meta.url)))
  }
})

test('ending content rejects missing variants, duplicate slides and invented conditions', () => {
  for (const mutate of [
    slides => { slides[0].defaultVariant = 'missing' },
    slides => { slides[0].rules[0].variant = 'missing' },
    slides => { slides[1].id = slides[0].id },
    slides => { slides.pop() },
    slides => { slides[2].rules[0].when.absentNpcId = 'missing' },
    slides => { slides[1].rules[0].when.decision.value = 'invented' },
    slides => { slides[0].rules[0].when = {} },
  ]) {
    const data = content()
    mutate(data.story.endingSlides.slides)
    assert.throws(() => validateContent(data), /endingSlides/)
  }
})
