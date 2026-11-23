import test from 'node:test'
import assert from 'node:assert/strict'
import { content } from '../helpers/content.mjs'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'
import { validateContent } from '../../src/app/content/validateContent.ts'

/** Provide mutable capability values to verify that stale menus recheck both requirements. */
function setup() {
  let trust = 0
  let skill = 0
  let effects = 0
  const dialogue = new DialogueService(undefined, {
    getTrust: () => trust, skill: () => skill,
    canChoose: () => true, choose: () => true,
  }, undefined, () => { effects++ })
  return {
    dialogue,
    setLevels: (nextTrust, nextSkill) => { trust = nextTrust; skill = nextSkill },
    effects: () => effects,
  }
}

test('all residents expose five editable topics with independent trust and skill gates', () => {
  const data = content()
  for (const [npcId, npc] of Object.entries(data.npcs)) {
    const definition = data.dialogues[npc.dialogueId]
    const topics = definition.nodes['ask-about'].choices.filter(c =>
      c.skillRequirement && c.trustRequirement !== undefined)
    assert.equal(topics.length, 5, npcId)
    assert.deepEqual(topics.map(c => c.trustRequirement), [1, 2, 3, 4, 5])
    assert.deepEqual(topics.map(c => c.skillRequirement.level), [4, 6, 8, 10, 12])
    for (const choice of topics) {
      const { dialogue, setLevels, effects } = setup()
      const required = choice.skillRequirement.level
      const trust = choice.trustRequirement
      dialogue.openDialogue(npc.name, definition, npcId)
      dialogue.chooseReply('ask-about')
      const menu = dialogue.getSnapshot().conversation
      assert.ok(menu.choices.some(c => c.text.includes(`[Trust 0/${trust}]`)))
      setLevels(trust - 1, required)
      dialogue.chooseReply(choice.id)
      assert.equal(dialogue.getSnapshot().conversation, menu)
      setLevels(trust, required - 1)
      dialogue.chooseReply(choice.id)
      assert.equal(dialogue.getSnapshot().conversation, menu)
      assert.equal(effects(), 1, 'blocked replies have no dialogue effects')
      setLevels(trust, required)
      dialogue.chooseReply(choice.id)
      assert.equal(dialogue.getSnapshot().conversation.text, definition.nodes[choice.next].text)
      dialogue.chooseReply('ask-more')
      setLevels(0, 0)
      const stale = dialogue.getSnapshot().conversation
      dialogue.chooseReply(choice.id)
      assert.equal(dialogue.getSnapshot().conversation, stale)
      dialogue.chooseReply('back')
      assert.equal(dialogue.getSnapshot().conversation.text, definition.openingLines[0])
    }
  }
})

test('dialogue schemas reject invalid trust thresholds and unknown skill names', () => {
  for (const value of [0, 6, 1.5]) {
    const data = structuredClone(content())
    data.dialogues.bartender.nodes['ask-about'].choices[0].trustRequirement = value
    assert.throws(() => validateContent(data), /trustRequirement/)
  }
  const data = structuredClone(content())
  data.dialogues.bartender.nodes['ask-about'].choices[0].skillRequirement.skill = 'unknown'
  assert.throws(() => validateContent(data), /skillRequirement.skill/)
})

test('requirements precede editable text even without markers or with markers after the question', () => {
  const { dialogue, setLevels } = setup()
  setLevels(3, 7)
  const reply = { id: 'question', text: 'Question?', next: 'answer',
    trustRequirement: 4, skillRequirement: { skill: 'medicine', level: 10 } }
  const definition = { start: 'root', nodes: {
    root: { text: 'Ask away.', choices: [reply] },
    answer: { text: 'Answer.', choices: [] },
  } }
  for (const text of ['Question?', 'Question? [Medicine] [Trust]']) {
    reply.text = text
    dialogue.openDialogue('Nurse', definition, 'nurse')
    assert.equal(dialogue.getSnapshot().conversation.choices[0].text,
      '[Trust 3/4] [Medicine 7/10] Question?')
  }
})
