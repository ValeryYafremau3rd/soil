import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { emptyStory, storySetup } from '../helpers/story.mjs'
import { resolveEndingSlides } from '../../src/domain/quests/endingSlides.ts'

const config = content().story.endingSlides
const ids = ['departure', 'disappeared', 'dusan', 'milena', 'irina', 'nadia',
  'zofia', 'viktor', 'elena', 'pavel', 'district', 'beyond']

/** Read one resolved narration by its stable slide identifier. */
function narration(state, id) {
  return resolveEndingSlides(config, state).find(slide => slide.id === id).text
}

/** Read one supplied narration variant for exact text comparisons. */
function variant(id, key) {
  return config.slides.find(slide => slide.id === id).variants[key]
}

for (const route of ['illegal', 'official']) {
  test(`ending resolves twelve ordered slides for the saved ${route} route`, () => {
    const state = { ...emptyStory(), flags: { ending_route: route } }
    const slides = resolveEndingSlides(config, state)
    assert.deepEqual(slides.map(slide => slide.id), ids)
    assert.ok(slides.every((slide, index) =>
      slide.image === `assets/background/story/${index % 3 + 1}.png`))
    assert.ok(slides.every(slide => typeof slide.text === 'string' && slide.text.length > 20))
    assert.equal(slides[0].text, variant('departure',
      route === 'official' ? 'government_permit' : 'titan_key'))
    assert.equal(narration(state, 'pavel'), variant('pavel',
      route === 'official' ? 'cooperated' : 'in_power'))
    assert.ok(slides.at(-1).text.endsWith('The journey had only begun.'))
  })
}

test('ordinary baselines and unknown proposed flags cannot manufacture rescue or death outcomes', () => {
  const state = { ...emptyStory(), flags: { dusan_status: 'dead', milena_status: 'rescued' } }
  for (const [id, key] of [['dusan', 'default'], ['milena', 'safe'], ['irina', 'default'],
    ['nadia', 'default'], ['zofia', 'loyal'], ['viktor', 'default'], ['elena', 'loyal'],
    ['pavel', 'in_power'], ['district', 'controlled']]) {
    assert.equal(narration(state, id), variant(id, key))
  }
})

for (const outcome of ['warn', 'report']) {
  test(`Dusan's playable ${outcome} decision selects his actual final state`, () => {
    const session = storySetup([], 'night', () => ({ persuasion: 14, erudition: 16 }))
    session.restore('factory-locked-workshop', 2)
    session.open('worker')
    session.dialogue.chooseReply('decision-topic-dusan_fate')
    session.dialogue.chooseReply(outcome === 'warn' ? 'factory-workshop-report'
      : 'factory-workshop-report-report')
    assert.equal(session.story.getSnapshot().decisions.dusan_fate, outcome)
    if (outcome === 'report') {
      assert.equal(narration(session.story.getSnapshot(), 'dusan'), variant('dusan', 'default'))
    }
    session.daytime.nextMorning()
    assert.equal(narration(session.story.getSnapshot(), 'dusan'),
      variant('dusan', outcome === 'warn' ? 'safe' : 'arrested'))
  })
}

for (const outcome of ['copy', 'expose', 'pavel']) {
  test(`patient records ${outcome} selects one Milena and records narration after reload`, () => {
    const session = storySetup()
    session.restore('hospital-no-visitors', 2)
    session.open('stranger')
    session.dialogue.chooseReply('decision-topic-patient_records_fate')
    session.dialogue.chooseReply(outcome === 'copy' ? 'hospital-no-visitors-decision'
      : `hospital-no-visitors-decision-${outcome}`)
    session.daytime.nextMorning()
    const saved = JSON.parse(JSON.stringify(session.story.getSnapshot()))
    assert.equal(narration(saved, 'milena'),
      variant('milena', outcome === 'expose' ? 'detained' : 'safe'))
    assert.equal(narration(saved, 'disappeared'),
      variant('disappeared', outcome === 'expose' ? 'records_exposed' : 'records_hidden'))
  })
}

test('Elena detention has its own narration and resolved slides stay frozen', () => {
  const state = { ...emptyStory(), absentNpcIds: ['citizen-caretaker'] }
  const slides = resolveEndingSlides(config, state)
  assert.equal(slides.find(slide => slide.id === 'elena').text, variant('elena', 'detained'))
  state.absentNpcIds.length = 0
  assert.equal(slides.find(slide => slide.id === 'elena').text, variant('elena', 'detained'))
})
