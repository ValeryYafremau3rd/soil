import type { DialogueDefinition } from '../../../domain/dialogue/dialogue'
import type { StoryConfig, StoryInteraction, StoryState } from '../../../domain/quests/story'
import type { DialogueController } from '../../contracts/dialogue'
import type { QuestController } from '../../contracts/quests'

/** Resolves authored clues and missing-NPC recovery through narrow quest/dialogue actions. */
export class StoryInteractions {
  private readonly config: StoryConfig
  private readonly quests: QuestController
  private readonly dialogue: Pick<DialogueController, 'openInvestigation'>
  private readonly notify: (text: string) => void

  /**
   * Bind world-object actions without owning narrative state or rendering resources.
   * @param {StoryConfig} config - Authored interactions and exit requirements.
   * @param {QuestController} quests - Atomic stage and route completion capabilities.
   * @param {Pick<DialogueController, 'openInvestigation'>} dialogue - Readable investigation presenter.
   * @param {(text: string) => void} notify - Player feedback for unavailable interactions.
   */
  constructor(
    config: StoryConfig,
    quests: QuestController,
    dialogue: Pick<DialogueController, 'openInvestigation'>,
    notify: (text: string) => void,
  ) {
    this.config = config
    this.quests = quests
    this.dialogue = dialogue
    this.notify = notify
  }

  /**
   * Read a clue, perform an attached stage or complete one alternative exit.
   * @param {string} id - World-object identifier.
   * @param {StoryState} state - Current facts, decisions and schedule overrides.
   * @param {(route: 'illegal' | 'official') => void} end - Commit terminal story facts.
   * @returns {boolean} Whether the object accepted the interaction.
   */
  interact(id: string, state: StoryState, end: (route: 'illegal' | 'official') => void): boolean {
    const object = this.config.interactions.find(object => object.id === id)
    if (!object || state.flags.prologue_complete) return false
    if (object.absentNpcId && !state.absentNpcIds.includes(object.absentNpcId)) return false
    if (object.route) return this.depart(object.route, state, end)
    if (object.fallbackNpcId) return this.recoverClue(object)
    const permitted = id !== 'checkpoint-handoff'
      || state.decisions.government_exit_bargain === 'accept'
    const advanced = permitted && this.quests.interactWorld(id)
    const inspected = advanced || this.hasInspected(object)
    this.dialogue.openInvestigation({ start: 'clue', nodes: {
      clue: { text: inspected ? object.text : this.config.messages.unavailable,
        choices: [{ id: 'close', text: this.config.messages.leave, close: true }] },
    } })
    return true
  }

  /**
   * Permit rereading a discovered clue without replaying its stage or inventory grant.
   * @param {StoryInteraction} object - Authored quest-stage binding.
   * @returns {boolean} Whether this run has already passed the inspection stage.
   */
  private hasInspected(object: StoryInteraction): boolean {
    const quest = this.quests.definitions.find(quest => quest.id === object.questId)
    const index = quest?.stages.findIndex(stage => stage.id === object.stageId) ?? -1
    const run = this.quests.getSnapshot().progress.find(run => run.questId === object.questId)
    return index >= 0 && Boolean(run && run.stageIndex > index)
  }

  /**
   * Recover active mandatory dialogue clues from notes after an NPC disappears.
   * @param {StoryInteraction} object - Notice tied to the absent NPC and existing scenery.
   * @returns {boolean} Opens a readable account, retaining original item and timing checks.
   */
  private recoverClue(object: StoryInteraction): boolean {
    const npcId = object.fallbackNpcId!
    const candidates = this.quests.definitions.flatMap(quest => quest.stages.flatMap(stage =>
      stage.trigger.kind === 'dialogue' && this.quests.canAdvanceDialogue(
        quest.id, npcId, stage.trigger.choiceId)
        ? [{ questId: quest.id, choiceId: stage.trigger.choiceId, description: stage.description }] : []))
    const choices = candidates.map((stage, index) => ({
      id: String(index), text: stage.description, close: true as const,
    }))
    const definition: DialogueDefinition = { start: 'notice', nodes: {
      notice: { text: object.text,
        choices: [...choices, { id: 'close', text: this.config.messages.leave, close: true }] },
    } }
    this.dialogue.openInvestigation(definition, {
      canChoose: id => id === 'close' || Boolean(candidates[Number(id)]),
      choose: id => {
        if (id === 'close') return true
        const clue = candidates[Number(id)]
        return Boolean(clue && this.quests.advanceDialogue(clue.questId, npcId, clue.choiceId))
      },
    }, npcId)
    return true
  }

  /**
   * Gate departure on story readiness and commit its complete inventory transaction.
   * @param {'illegal' | 'official'} route - Physical exit selected.
   * @param {StoryState} state - Current story readiness and negotiation result.
   * @param {(route: 'illegal' | 'official') => void} end - Persistent ending commit callback.
   * @returns {boolean} Whether departure succeeded; failed attempts remain retryable.
   */
  private depart(
    route: 'illegal' | 'official', state: StoryState,
    end: (route: 'illegal' | 'official') => void,
  ): boolean {
    if (!state.flags.escape_routes_unlocked || route === 'official'
      && (!state.flags.official_exit_ready || state.decisions.government_exit_bargain !== 'accept')
      || !this.quests.completeEscape(route)) {
      this.notify(route === 'illegal'
        ? this.config.messages.illegalBlocked : this.config.messages.officialBlocked)
      return false
    }
    end(route)
    return true
  }
}
