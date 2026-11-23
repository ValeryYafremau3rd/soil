import assert from 'node:assert/strict'
import test from 'node:test'
import { content } from '../helpers/content.mjs'
import { withNpcDirections } from '../../src/app/content/npcDirections.ts'
import { resolveNpcPlacements } from '../../src/app/content/resolveNpcPlacements.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'

const data = content()
const template = data.dialogues['npc-directions']
const prepare = (definition, phase, npcs = data.npcs) => withNpcDirections(definition, template, npcs,
  data.locations, phase, data.buildings, data.rooms)

test('every NPC can locate the configured roster in every phase using world placements', () => {
  for (const phase of ['morning', 'afternoon', 'evening', 'night']) {
    for (const npc of Object.values(data.npcs)) {
      const dialogue = new DialogueService(undefined, undefined, undefined, undefined, undefined, undefined,
        definition => prepare(definition, phase))
      dialogue.openDialogue(npc.name, data.dialogues[npc.dialogueId])
      dialogue.chooseReply('$npc-directions:list')
      const names = dialogue.getSnapshot().conversation.choices.map(choice => choice.text)
      for (const [id, target] of Object.entries(data.npcs)) {
        assert.ok(names.includes(target.name))
        dialogue.chooseReply(`$npc-directions:${id}`)
        const answer = dialogue.getSnapshot().conversation.text
        assert.ok(answer.includes(target.name))
        const location = data.locations.find(location => resolveNpcPlacements(data.npcs, data.locations, location.id, phase).some(p => p.type === id))
        assert.ok(answer.includes(location.name))
        assert.ok(!answer.includes('{'))
        dialogue.chooseReply('back')
      }
      dialogue.chooseReply('back')
      assert.equal(dialogue.getSnapshot().conversation.text, data.dialogues[npc.dialogueId].nodes[data.dialogues[npc.dialogueId].start].text)
      dialogue.chooseReply('goodbye')
      assert.equal(dialogue.getSnapshot().conversation, null)
    }
  }
})

test('reopening uses the new phase; disabled NPCs report unknown and investigations have no directory', () => {
  let phase = 'morning'
  const definition = data.dialogues.worker
  const dialogue = new DialogueService(undefined, undefined, undefined, undefined, undefined, undefined,
    definition => prepare(definition, phase))
  for (phase of ['morning', 'night']) {
    dialogue.openDialogue('Worker', definition)
    dialogue.chooseReply('$npc-directions:list')
    dialogue.chooseReply('$npc-directions:worker')
    const expected = prepare(definition, phase).nodes['$npc-directions:worker'].text
    assert.equal(dialogue.getSnapshot().conversation.text, expected)
    dialogue.closeDialogue()
  }
  const npcs = { ...data.npcs, worker: { ...data.npcs.worker, schedule: {
    morning: { locationId: 'factory', x: 0.5, enabled: false },
  } } }
  assert.equal(prepare(definition, 'morning', npcs).nodes['$npc-directions:worker'].text,
    "I don't know where Irina Kovalenko is right now.")
  dialogue.openInvestigation(data.dialogues.awakening)
  assert.ok(dialogue.getSnapshot().conversation.choices.every(choice => !choice.id.startsWith('$npc-directions:')))
})
