import assert from 'node:assert/strict'
import test from 'node:test'
import { content, catalogue } from '../helpers/content.mjs'
import { chooseAdvice } from '../../src/domain/dialogue/dialogue.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'
import { PerksService } from '../../src/app/services/character/PerksService.ts'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { createCharacter } from '../../src/domain/skills/character.ts'
import { emptyPerks, perkCharacter } from '../../src/domain/character/perks.ts'

const data = content()

test('social choices show current effective skills and advice has a single Persuade option', () => {
  let persuasion = 7, intimidation = 4
  const accepted = []
  const dialogue = new DialogueService(undefined, undefined, undefined, choice => accepted.push(choice),
    { skill: () => intimidation, day: () => 1, pay: () => true, notify: () => {} },
    { config: data.advice, skill: () => persuasion, day: () => 1, onAsked: () => {} })
  dialogue.openDialogue('Milos', data.dialogues.stranger, 'stranger')
  let choices = dialogue.getSnapshot().conversation.choices
  assert.equal(choices.find(choice => choice.id === 'advice').text, '[Persuade 7] Could you share some advice?')
  assert.equal(choices.some(choice => choice.id === 'persuade-advice'), false)
  assert.equal(choices.find(choice => choice.id === 'intimidate-money').text, '[Intimidate 4] Hand over your Thalers. Now.')
  assert.equal(choices.some(choice => choice.id === 'intimidate-advice'), false)
  persuasion = 10
  intimidation = 8
  dialogue.openDialogue('Milos', data.dialogues.stranger, 'stranger')
  choices = dialogue.getSnapshot().conversation.choices
  assert.match(choices.find(choice => choice.id === 'advice').text, /^\[Persuade 10\]/)
  assert.match(choices.find(choice => choice.id === 'intimidate-money').text, /^\[Intimidate 8\]/)
  dialogue.chooseReply('advice')
  assert.equal(accepted.at(-1).approach, 'persuasion')
})

test('50 unique advice entries span levels 1–20 and Persuasion only expands the available pool', () => {
  assert.equal(data.advice.entries.length, 50)
  assert.equal(new Set(data.advice.entries.map(entry => entry.id)).size, 50)
  assert.equal(new Set(data.advice.entries.map(entry => entry.level)).size, 20)
  for (let level = 1; level <= 20; level++) {
    const available = data.advice.entries.filter(entry => entry.level <= level)
    const drawn = available.map((_, index) => chooseAdvice(data.advice, level, () => (index + 0.5) / available.length))
    assert.deepEqual(drawn, available)
  }
  assert.equal(chooseAdvice(data.advice, 0, () => 0).level, 1)
  assert.equal(chooseAdvice(data.advice, 100, () => 1).level, 20)
})

test('advice is once per NPC per day across all reply paths, cancellation, reopening and restored state', () => {
  let day = 1, skill = 1, asked = 0
  const options = { config: data.advice, day: () => day, skill: () => skill, random: () => 0, onAsked: () => asked++ }
  const dialogue = new DialogueService(undefined, undefined, undefined, undefined, undefined, options)
  const definition = data.dialogues.stranger
  dialogue.openDialogue('First', definition, 'first')
  dialogue.closeDialogue()
  assert.deepEqual(dialogue.saveAdviceState(), {})
  dialogue.openDialogue('First', definition, 'first')
  dialogue.chooseReply('missing')
  assert.equal(asked, 0)
  dialogue.chooseReply('advice')
  assert.match(dialogue.getSnapshot().conversation.text, /^\[Common advice\]/)
  dialogue.chooseReply('back')
  assert.equal(dialogue.getSnapshot().conversation.choices.some(choice => choice.id.endsWith('advice')), false)
  for (const id of ['advice', 'persuade-advice', 'intimidate-advice']) dialogue.chooseReply(id)
  assert.equal(asked, 1)
  dialogue.closeDialogue()
  dialogue.openDialogue('First', definition, 'first')
  dialogue.chooseReply('advice')
  assert.equal(asked, 1)
  dialogue.openDialogue('Second', definition, 'second')
  dialogue.chooseReply('advice')
  assert.equal(asked, 2)
  const restored = new DialogueService(undefined, undefined, undefined, undefined, undefined,
    { ...options, saved: dialogue.saveAdviceState() })
  restored.openDialogue('First', definition, 'first')
  restored.chooseReply('advice')
  assert.equal(asked, 2)
  day++
  skill = 20
  restored.openDialogue('First', definition, 'first')
  restored.chooseReply('advice')
  assert.equal(asked, 3)
})

test('ten actual advice requests earn Nerd and ten successful intimidations earn Punk with exact skill changes', () => {
  for (const [id, action, expected] of [['nerd', 'adviceAsked', { erudition: 2, intimidation: -1, martialArts: -1 }],
    ['punk', 'intimidated', { erudition: -1, persuasion: -1, martialArts: 1, athletics: 1 }]]) {
    const perks = new PerksService(data.ui.perks, new DayTimeService(), { drain() {} })
    let day = 1
    const dialogue = new DialogueService(undefined, undefined, undefined,
      choice => { if (choice.approach === 'intimidation') perks.recordAction('intimidated') },
      { skill: () => 5, day: () => day, pay: () => true, notify: () => {} },
      { config: data.advice, skill: () => 5, day: () => day, onAsked: () => perks.recordAction('adviceAsked') })
    for (let index = 0; index < 10; index++) {
      dialogue.openDialogue('Milos', data.dialogues.stranger, 'stranger')
      dialogue.chooseReply(action === 'adviceAsked' ? 'advice' : 'intimidate-money')
      dialogue.chooseReply(action === 'adviceAsked' ? 'advice' : 'intimidate-money')
      if (index < 9) assert.equal(perks.getSnapshot().acquired.includes(id), false)
      day++
    }
    assert.equal(perks.getSnapshot().counts[id], 10)
    assert.ok(perks.getSnapshot().acquired.includes(id))
    const character = createCharacter({ id: 'test', name: 'Test', attributes: { strength: 5, agility: 5, intelligence: 5, willpower: 5, charisma: 5 }, startingItems: [] })
    const normal = perkCharacter(character, emptyPerks(), [], data.ui.perks)
    const adjusted = perkCharacter(character, perks.getSnapshot(), [], data.ui.perks)
    for (const key of Object.keys(normal.skills)) assert.equal(adjusted.skills[key] - normal.skills[key], expected[key] ?? 0)
  }
})

test('advice authoring rejects out-of-range levels, missing starter tips, bad rarity and duplicate IDs', () => {
  for (const mutate of [
    config => { config.entries[0].level = 0 }, config => { config.entries[0].level = 21 },
    config => { config.entries[0].level = 1.5 }, config => { config.entries[0].rarity = 'mythic' },
    config => { config.entries[1].id = config.entries[0].id },
    config => { config.entries = config.entries.filter(entry => entry.level !== 1) },
  ]) {
    const { data, sources } = catalogue()
    mutate(data.advice)
    assert.throws(() => validateContent(data, sources), /src\/content\/advice.json/)
  }
})
