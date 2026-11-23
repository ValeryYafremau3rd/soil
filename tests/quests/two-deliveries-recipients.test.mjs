import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyStory, progressFor, storySetup } from '../helpers/story.mjs'

for (const waterDelivered of [false, true]) {
  test(`two deliveries remain available after Elena disappears; water done=${waterDelivered}`, () => {
    const { data, inventory, quests, story, open, dialogue } = storySetup([
      { itemId: 'duct-tape', quantity: 1 },
      ...(!waterDelivered ? [{ itemId: 'water-bottle', quantity: 1 }] : []),
    ])
    const absentNpcIds = data.story.decisions.flatMap(decision =>
      decision.options.flatMap(option => option.npcId ? [option.npcId] : []))
    const progress = progressFor(data, 'cashier-4', 1)
    if (waterDelivered) progress.find(entry => entry.questId === 'cashier-4')
      .completedStageIds = ['cashier-4-deliver-1']
    quests.restoreState(progress)
    story.restoreState({ ...emptyStory(), absentNpcIds })
    const quest = data.quests.find(quest => quest.id === 'cashier-4')
    for (const stage of quest.stages.slice(1, 3)) {
      assert.equal(story.isNpcAbsent(stage.trigger.npcId), false)
    }
    assert.equal(quests.canAdvanceDialogue(
      'cashier-4', 'citizen-caretaker', 'cashier-4-deliver-0'
    ), false)
    open('citizen-clerk')
    dialogue.chooseReply('cashier-4-deliver-0')
    assert.equal(inventory.getSnapshot().items.some(item => item.itemId === 'duct-tape'), false)
    if (!waterDelivered) {
      open('worker')
      dialogue.chooseReply('cashier-4-deliver-1')
    }
    assert.equal(quests.getSnapshot().progress.find(entry => entry.questId === 'cashier-4')
      .stageIndex, 3)
  })
}
