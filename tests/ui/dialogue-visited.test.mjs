import assert from 'node:assert/strict'
import test from 'node:test'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'

const menu = {
  start: 'root',
  nodes: {
    root: { text: 'Hello', choices: [{ id: 'topic', text: 'Questions', next: 'topic' }] },
    topic: { text: 'Questions', choices: [
      { id: 'first', text: 'First question', next: 'answer' },
      { id: 'nested', text: 'More questions', next: 'nested' },
      { id: 'back', text: 'Back', next: 'root' },
    ] },
    answer: { text: 'Answer', choices: [{ id: 'back', text: 'Back', next: 'topic' }] },
    nested: { text: 'More questions', choices: [
      { id: 'last', text: 'Last question', next: 'last' },
      { id: 'back', text: 'Back', next: 'topic' },
      { id: 'goodbye', text: 'Goodbye', close: true },
    ] },
    last: { text: 'Last answer', choices: [{ id: 'back', text: 'Back', next: 'nested' }] },
  },
}

function visited(dialogue, id) {
  return dialogue.getSnapshot().conversation.choices.find(choice => choice.id === id)?.visited
}

test('parents stay fresh until all nested questions are selected, ignoring returns and exits', () => {
  const dialogue = new DialogueService()
  dialogue.openDialogue('Resident', menu, 'resident')
  dialogue.chooseReply('topic')
  dialogue.chooseReply('back')
  assert.equal(visited(dialogue, 'topic'), undefined)

  dialogue.chooseReply('topic')
  dialogue.chooseReply('first')
  dialogue.chooseReply('back')
  assert.equal(visited(dialogue, 'first'), true)
  dialogue.chooseReply('nested')
  dialogue.chooseReply('back')
  assert.equal(visited(dialogue, 'nested'), undefined)
  dialogue.chooseReply('back')
  assert.equal(visited(dialogue, 'topic'), undefined)

  dialogue.chooseReply('topic')
  dialogue.chooseReply('nested')
  dialogue.chooseReply('last')
  dialogue.chooseReply('back')
  assert.equal(visited(dialogue, 'last'), true)
  dialogue.chooseReply('back')
  assert.equal(visited(dialogue, 'nested'), true)
  dialogue.chooseReply('back')
  assert.equal(visited(dialogue, 'topic'), true)
  dialogue.closeDialogue()
  dialogue.openDialogue('Resident', menu, 'resident')
  assert.equal(visited(dialogue, 'topic'), true)
  dialogue.openDialogue('Other resident', menu, 'other')
  assert.equal(visited(dialogue, 'topic'), undefined)
})

test('newly visible and locked questions keep selected parent topics fresh', () => {
  let visible = false
  const dialogue = new DialogueService(undefined, {
    canChoose: () => visible,
    choose: () => true,
  })
  const definition = {
    start: 'root',
    nodes: {
      root: menu.nodes.root,
      topic: { text: 'Questions', choices: [
        { id: 'quest', text: 'Quest', questId: 'quest', trustRequirement: 5 },
        { id: 'back', text: 'Back', next: 'root' },
      ] },
    },
  }
  dialogue.openDialogue('Resident', definition, 'resident')
  dialogue.chooseReply('topic')
  dialogue.chooseReply('back')
  assert.equal(visited(dialogue, 'topic'), true)
  visible = true
  dialogue.openDialogue('Resident', definition, 'resident')
  assert.equal(visited(dialogue, 'topic'), undefined)
  dialogue.chooseReply('topic')
  dialogue.chooseReply('quest')
  assert.equal(visited(dialogue, 'quest'), undefined)
  dialogue.chooseReply('back')
  assert.equal(visited(dialogue, 'topic'), undefined)
})
