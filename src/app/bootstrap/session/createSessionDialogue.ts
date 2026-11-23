import { BUILDINGS } from '../../../content/buildings'
import { CONTENT } from '../../../content/catalogue'
import { DIALOGUES } from '../../../content/dialogues'
import { LOCATIONS } from '../../../content/locations'
import { ROOMS } from '../../../content/rooms'
import type { NpcDefinition } from '../../../content/types'
import type { AdviceConfiguration } from '../../../domain/dialogue/dialogue'
import type { Character } from '../../../domain/skills/character'
import { withNpcDirections } from '../../content/npcDirections'
import type { DayTimeController } from '../../contracts/daytime'
import type { InventoryController } from '../../contracts/inventory'
import type { MessageController } from '../../contracts/messages'
import type { NotesController } from '../../contracts/notes'
import type { PerksController } from '../../contracts/perks'
import type { QuestController } from '../../contracts/quests'
import type { SaveGame } from '../../contracts/save'
import { DialogueService } from '../../services/dialogue/DialogueService'
import type { StoryController } from '../../contracts/story'

/** Narrow service capabilities needed to compose NPC conversations. */
interface DialogueDependencies {
  getStory: () => StoryController
  inventory: Pick<InventoryController, 'openContainer' | 'tryExchangeItems'>
  quests: QuestController
  notes: Pick<NotesController, 'meetPerson'>
  daytime: Pick<DayTimeController, 'getSnapshot'>
  perks: Pick<PerksController, 'recordAction'>
  messages: Pick<MessageController, 'show'>
  currentCharacter: () => Character | null
  saved?: SaveGame
}

/**
 * Connect dialogue choices to quests, reputation, advice and NPC directions.
 * @param {DialogueDependencies} dependencies - Explicit conversation capabilities.
 * @returns {DialogueService} Conversation service with lazy character queries.
 */
export function createSessionDialogue({
  inventory, quests, notes, daytime, perks, messages, currentCharacter, saved, getStory,
}: DialogueDependencies): DialogueService {
  return new DialogueService(
    inventory.openContainer,
    {
      canChooseStory: choice => getStory().canChoose(choice),
      skill: skill => currentCharacter()?.skills[skill as keyof Character['skills']] ?? 0,
      isRepeatable: questId => Boolean(quests.definitions.find(quest => quest.id === questId)?.repeatable),
      getTrust: quests.getTrust,
      describeQuest: questId => {
        const quest = quests.definitions.find(quest => quest.id === questId)

        return quest?.destinations ? quest.description : undefined
      },
      canChoose: (npcId, choice) => quests.canAdvanceDialogue(
        choice.questId!, npcId, choice.questChoiceId ?? choice.id),
      /**
       * Commit a stage before storing its selected branch; failed handovers leave both untouched.
       * @param {string} npcId - Speaking NPC's stable identifier.
       * @param {import('../../../domain/dialogue/dialogue').DialogueChoice} choice - Selected reply.
       * @returns {boolean} Whether the quest transaction committed.
       */
      choose: (npcId, choice) => {
        const advanced = quests.advanceDialogue(
          choice.questId!, npcId, choice.questChoiceId ?? choice.id)
        if (advanced && choice.storyDecision) {
          getStory().decide(choice.storyDecision.id, choice.storyDecision.value)
        }
        if (advanced && npcId === 'citizen-clerk' && choice.id === 'find-work-ask') {
          quests.recordAction('workAsked')
        }
        return advanced
      },
      canOffer: quests.canOffer,
      acceptFromNpc: quests.acceptFromNpc,
      isCompleted: quests.isCompleted,
    },
    notes.meetPerson,
    choice => {
      perks.recordAction('dialogueChosen')
      if (choice.approach) perks.recordAction(choice.approach === 'persuasion' ? 'persuaded' : 'intimidated')
    },
    {
      skill: () => currentCharacter()?.skills.intimidation ?? 0,
      day: () => daytime.getSnapshot().day,
      pay: amount => inventory.tryExchangeItems([], [], amount),
      notify: messages.show,
      saved: saved?.intimidatedDays
    },
    {
      config: CONTENT.data.advice as AdviceConfiguration,
      skill: () => currentCharacter()?.skills.persuasion ?? 0,
      day: () => daytime.getSnapshot().day,
      onAsked: () => perks.recordAction('adviceAsked'),
      saved: saved?.adviceDays
    },
    definition => withNpcDirections(
      definition,
      DIALOGUES['npc-directions'],
      CONTENT.data.npcs as Readonly<Record<string, NpcDefinition>>,
      LOCATIONS,
      daytime.getSnapshot().phase,
      BUILDINGS,
      ROOMS,
      getStory().getSnapshot().absentNpcIds
    )
  )
}
