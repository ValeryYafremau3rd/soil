import { content } from './content.mjs'
import { DayTimeService } from '../../src/app/services/world/DayTimeService.ts'
import { DialogueService } from '../../src/app/services/dialogue/DialogueService.ts'
import { InventoryService } from '../../src/app/services/inventory/InventoryService.ts'
import { QuestService } from '../../src/app/services/quests/QuestService.ts'
import { StoryService } from '../../src/app/services/progression/StoryService.ts'
import { StoryInteractions } from '../../src/app/services/progression/StoryInteractions.ts'

export const emptyStory = () => ({ flags: {}, decisions: {}, consequences: [], absentNpcIds: [] })

/** Restore the requested stage with its prerequisites, leaving unrelated optional jobs untouched. */
export function progressFor(data, id, stageIndex) {
  const entries = new Map()
  function add(questId, index) {
    const quest = data.quests.find(q => q.id === questId)
    for (const prerequisite of quest.prerequisites ?? []) add(prerequisite)
    entries.set(questId, { questId, stageIndex: index ?? quest.stages.length })
  }
  add(id, stageIndex)
  return [...entries.values()]
}

/** Real inventory, quest and dialogue services; no Phaser or Vite discovery under Node. */
export function storySetup(items = [], phase = 'night', skills = () => ({})) {
  const data = content(), notifications = []
  const daytime = new DayTimeService(1, phase)
  const inventory = new InventoryService(data.items, [], () => 0, items)
  const quests = new QuestService(data.quests, inventory, text => notifications.push(text), daytime)
  let story
  const dialogue = new DialogueService(undefined, {
    canChooseStory: choice => story.canChoose(choice),
    skill: id => skills()[id] ?? 0,
    canChoose: (npcId, choice) => quests.canAdvanceDialogue(choice.questId, npcId, choice.questChoiceId ?? choice.id),
    choose: (npcId, choice) => {
      const done = quests.advanceDialogue(choice.questId, npcId, choice.questChoiceId ?? choice.id)
      if (done && choice.storyDecision) story.decide(choice.storyDecision.id, choice.storyDecision.value)
      return done
    },
    isCompleted: quests.isCompleted,
    canOffer: quests.canOffer,
    acceptFromNpc: quests.acceptFromNpc,
  })
  story = new StoryService(data.story, quests, daytime,
    new StoryInteractions(data.story, quests, dialogue, text => notifications.push(text)))
  const open = npcId => dialogue.openDialogue(data.npcs[npcId].name,
    data.dialogues[data.npcs[npcId].dialogueId], npcId)
  const restore = (id, stageIndex, state = emptyStory()) => {
    quests.restoreState(progressFor(data, id, stageIndex))
    story.restoreState(state)
  }
  return { data, inventory, quests, daytime, dialogue, story, open, restore, notifications }
}
