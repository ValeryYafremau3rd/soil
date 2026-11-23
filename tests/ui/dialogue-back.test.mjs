import assert from 'node:assert/strict'
import test from 'node:test'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'

const definition = {
  start: 'root',
  nodes: {
    root: { text: 'Hello', choices: [
      { id: 'topic', text: 'Questions', next: 'topic' },
      { id: 'other', text: 'Other questions', next: 'other' },
    ] },
    topic: { text: 'Questions', choices: [{ id: 'answer', text: 'Question', next: 'answer' }] },
    other: { text: 'Other questions', choices: [{ id: 'answer', text: 'Question', next: 'answer' }] },
    answer: { text: 'Answer', choices: [] },
  },
}

const ids = dialogue => dialogue.getSnapshot().conversation.choices.map(choice => choice.id)

test('every nested NPC menu gets Back without marking untouched questions as visited', () => {
  const effects = []
  const dialogue = new DialogueService(undefined, undefined, undefined, choice => effects.push(choice.id))
  dialogue.openDialogue('Resident', definition, 'resident')
  assert.equal(ids(dialogue).includes('back'), false)
  dialogue.chooseReply('back')
  assert.equal(dialogue.getSnapshot().conversation.text, 'Hello')
  dialogue.chooseReply('topic')
  assert.deepEqual(ids(dialogue), ['answer', 'back', 'goodbye'])
  dialogue.chooseReply('back')
  assert.equal(dialogue.getSnapshot().conversation.choices[0].visited, undefined)
  assert.deepEqual(effects, ['topic'])
  dialogue.chooseReply('topic')
  dialogue.chooseReply('answer')
  assert.deepEqual(ids(dialogue), ['back', 'goodbye'])
  dialogue.chooseReply('back')
  assert.equal(dialogue.getSnapshot().conversation.text, 'Questions')
  dialogue.chooseReply('back')
  assert.equal(dialogue.getSnapshot().conversation.text, 'Hello')
  dialogue.chooseReply('other')
  dialogue.chooseReply('answer')
  dialogue.chooseReply('back')
  assert.equal(dialogue.getSnapshot().conversation.text, 'Other questions')
  dialogue.closeDialogue()
  dialogue.openDialogue('Resident', definition, 'resident')
  assert.equal(ids(dialogue).includes('back'), false)
  assert.deepEqual(definition.nodes.answer.choices, [])
})

test('authored return choices are preserved without duplicates or stale history', () => {
  const dialogue = new DialogueService()
  const authored = structuredClone(definition)
  authored.nodes.answer.choices = [{ id: 'back', text: 'Something else.', next: 'root' }]
  dialogue.openDialogue('Resident', authored, 'resident')
  dialogue.chooseReply('topic')
  dialogue.chooseReply('answer')
  assert.equal(ids(dialogue).filter(id => id === 'back').length, 1)
  assert.equal(dialogue.getSnapshot().conversation.choices[0].text, 'Something else.')
  dialogue.chooseReply('back')
  assert.equal(dialogue.getSnapshot().conversation.text, 'Hello')
  assert.equal(ids(dialogue).includes('back'), false)
  dialogue.chooseReply('other')
  dialogue.chooseReply('back')
  assert.equal(dialogue.getSnapshot().conversation.text, 'Hello')
})

test('investigation menus retain their authored actions', () => {
  const dialogue = new DialogueService()
  dialogue.openInvestigation(definition)
  dialogue.chooseReply('topic')
  assert.deepEqual(ids(dialogue), ['answer'])
})
