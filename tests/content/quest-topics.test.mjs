import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { validateContent } from '../../src/app/content/validateContent.ts'

test('quest topics reject unknown quests, missing decision nodes and committing parent actions', () => {
  for (const mutate of [
    choice => { choice.questTopic = 'missing' },
    choice => { choice.next = 'greeting' },
    choice => { choice.questId = choice.questTopic },
    choice => { choice.acceptQuestId = choice.questTopic },
    choice => { choice.storyDecision = { id: 'dusan_fate', value: 'warn' } },
  ]) {
    const data = content()
    const definition = data.dialogues.worker
    mutate(definition.nodes[definition.start].choices.find(choice => choice.questTopic))
    assert.throws(() => validateContent(data), /questTopic|storyDecision|unknown decision/)
  }
})
