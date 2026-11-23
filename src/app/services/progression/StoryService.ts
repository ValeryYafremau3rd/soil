import type { DialogueChoice } from '../../../domain/dialogue/dialogue'
import type { StoryConfig, StoryState } from '../../../domain/quests/story'
import { meetsStoryConditions } from '../../../domain/quests/story.ts'
import type { DayTimeController } from '../../contracts/daytime'
import type { QuestController } from '../../contracts/quests'
import type { StoryController } from '../../contracts/story'
import { ObservableStore } from '../core/ObservableStore.ts'
import { StoryInteractions } from './StoryInteractions.ts'

/** Owns persistent story facts, branch decisions and next-day consequence scheduling. */
export class StoryService extends ObservableStore<StoryState> implements StoryController {
  private readonly config: StoryConfig
  private readonly quests: QuestController
  private readonly day: () => number
  private readonly interactions: StoryInteractions

  /**
   * Bind narrative progression after quest services exist; restore after quest restoration.
   * @param {StoryConfig} config - Authored narrative effects and interaction definitions.
   * @param {QuestController} quests - Quest queries and atomic progression actions.
   * @param {DayTimeController} daytime - Observable clock for delayed consequences.
   * @param {StoryInteractions} interactions - World interaction orchestration.
   */
  constructor(
    config: StoryConfig,
    quests: QuestController,
    daytime: DayTimeController,
    interactions: StoryInteractions,
  ) {
    super({ flags: {}, decisions: {}, consequences: [], absentNpcIds: [] })
    this.config = config
    this.quests = quests
    this.day = () => daytime.getSnapshot().day
    this.interactions = interactions
    quests.subscribe(this.sync)
    daytime.subscribe(this.sync)
  }

  /**
   * Restore narrative state and derive safe branch defaults for legacy completed stages.
   * @param {StoryState | undefined} saved - Optional narrative payload from a validated save.
   * @returns {void} Reconciles quest evidence and any overdue next-day consequences.
   */
  restoreState(saved?: StoryState): void {
    if (saved) this.snapshot = structuredClone(saved)
    else for (const decision of this.config.decisions) {
      const quest = this.quests.definitions.find(q => q.id === decision.questId)
      const stage = quest?.stages.findIndex(s => s.trigger.kind === 'dialogue'
        && s.trigger.choiceId === decision.choiceId) ?? -1
      const run = this.quests.getSnapshot().progress.find(p => p.questId === decision.questId)
      if (run && stage >= 0 && run.stageIndex > stage) {
        this.snapshot = { ...this.snapshot,
          decisions: { ...this.snapshot.decisions, [decision.id]: decision.legacyDefault } }
      }
    }
    this.sync()
  }

  /**
   * Filter story replies using authored conditions and immutable branch choices.
   * @param {DialogueChoice} choice - Reply already checked against normal quest conditions.
   * @returns {boolean} Whether the reply's narrative requirements are satisfied.
   */
  canChoose = (choice: DialogueChoice): boolean => {
    if (!meetsStoryConditions(choice, this.snapshot)) return false
    const branch = choice.storyDecision
    if (!branch) return true
    const decision = this.config.decisions.find(d => d.id === branch.id)
    return Boolean(decision && decision.questId === choice.questId
      && decision.choiceId === (choice.questChoiceId ?? choice.id)
      && !this.snapshot.decisions[branch.id]
      && decision.options.some(option => option.value === branch.value))
  }

  /**
   * Store a selected branch after its quest stage commits, scheduling removal once.
   * @param {string} id - Authored decision identifier.
   * @param {string} value - Selected option value.
   * @returns {boolean} Whether a valid, previously unset decision committed.
   */
  decide = (id: string, value: string): boolean => {
    const decision = this.config.decisions.find(d => d.id === id)
    const option = decision?.options.find(option => option.value === value)
    if (!decision || !option || this.snapshot.decisions[id]) return false
    const quest = this.quests.definitions.find(q => q.id === decision.questId)
    const index = quest?.stages.findIndex(s => s.trigger.kind === 'dialogue'
      && s.trigger.choiceId === decision.choiceId) ?? -1
    const run = this.quests.getSnapshot().progress.find(p => p.questId === decision.questId)
    if (!run || index < 0 || run.stageIndex <= index) return false
    this.publish({ ...this.snapshot,
      decisions: { ...this.snapshot.decisions, [id]: value },
      consequences: [...this.snapshot.consequences, ...(option.npcId
        ? [{ npcId: option.npcId, day: this.day() + this.config.consequenceDelayDays }] : [])],
    })
    return true
  }

  /**
   * Query the schedule override shared by world spawns and NPC directions.
   * @param {string} npcId - Stable NPC identifier.
   * @returns {boolean} Whether all ordinary appearances and services are suppressed.
   */
  isNpcAbsent = (npcId: string): boolean => this.snapshot.absentNpcIds.includes(npcId)

  /**
   * Dispatch a concrete world interaction using the current narrative snapshot.
   * @param {string} id - Authored world interaction identifier.
   * @returns {boolean} Whether the interaction produced a clue, conversation or departure.
   */
  interact = (id: string): boolean => this.interactions.interact(id, this.snapshot, this.end)

  /**
   * Persist the chosen route only after the atomic exit transaction succeeds.
   * @param {'illegal' | 'official'} route - Completed alternative world exit.
   * @returns {void} Publishes the terminal prologue state once.
   */
  private end = (route: 'illegal' | 'official'): void => {
    this.publish({ ...this.snapshot,
      flags: { ...this.snapshot.flags, prologue_complete: true, ending_route: route },
    })
  }

  /**
   * Derive discovered evidence and execute consequences due on or before this day.
   * @returns {void} Publishes only when facts, queued consequences or absences change.
   */
  private sync = (): void => {
    const flags = { ...this.snapshot.flags }
    for (const [questId, flag] of Object.entries(this.config.completedFlags)) {
      if (this.quests.isCompleted(questId)) flags[flag] = true
    }
    const permit = this.quests.getSnapshot().progress.find(p =>
      p.questId === 'prologue-government-exit')
    if (permit && permit.stageIndex >= 3 && this.snapshot.decisions.government_exit_bargain === 'accept') {
      flags.official_exit_ready = true
    }
    const due = this.snapshot.consequences.filter(effect => effect.day <= this.day())
    const next = { ...this.snapshot, flags,
      consequences: this.snapshot.consequences.filter(effect => effect.day > this.day()),
      absentNpcIds: [...new Set([...this.snapshot.absentNpcIds, ...due.map(e => e.npcId)])],
    }
    if (JSON.stringify(next) !== JSON.stringify(this.snapshot)) this.publish(next)
  }
}
