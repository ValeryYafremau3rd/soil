import { ObservableStore } from '../core/ObservableStore.ts'
import { DialogueNavigation } from './DialogueNavigation.ts'
import { formatChoiceRequirements } from '../../../domain/dialogue/choiceRequirements.ts'
import { isChoiceExhausted } from '../../../domain/dialogue/visitedChoices.ts'
import type { DialogueController, DialogueSnapshot } from '../../contracts/dialogue'
import type { AdviceConfiguration, DialogueChoice, DialogueDefinition } from '../../../domain/dialogue/dialogue'
import { advanceDialogue, chooseAdvice, intimidationPayment, INTIMIDATE_MONEY, orderNpcChoices } from '../../../domain/dialogue/dialogue.ts'

/**
 * Advice actions supplied to dialogue orchestration.
 */
interface AdviceActions {
  config: AdviceConfiguration
  skill(): number
  day(): number
  onAsked(): void
  saved?: Readonly<Record<string, number>>
  random?: () => number
}

/**
 * Intimidation actions supplied to dialogue orchestration.
 */
interface IntimidationActions {
  skill(): number
  day(): number
  pay(amount: number): boolean
  notify(message: string): void
  saved?: Readonly<Record<string, number>>
}

/**
 * Quest actions supplied to dialogue orchestration.
 */
interface QuestActions {
  canChooseStory?(choice: DialogueChoice): boolean
  skill?(skill: string): number
  isRepeatable?(questId: string): boolean
  describeQuest?(questId: string): string | undefined
  canChoose(npcId: string, choice: DialogueChoice): boolean
  choose(npcId: string, choice: DialogueChoice): boolean
  canOffer?(questId: string, npcId: string): boolean
  acceptFromNpc?(questId: string, npcId: string): boolean
  isCompleted?(questId: string): boolean
  getTrust?(npcId: string): number
}

/**
 * Owns dialogue service state and behavior.
 */
export class DialogueService extends ObservableStore<DialogueSnapshot> implements DialogueController {
  private definition?: DialogueDefinition
  private readonly visited = new Set<string>()
  private readonly navigation = new DialogueNavigation()
  private readonly openingIndexes = new Map<string, number>()
  private nodeId = ''
  private investigationActions?: {
    canChoose(id: string): boolean
    choose(id: string): boolean
  }
  private investigating = false
  private readonly openBarter: (containerId: string) => void
  private npcId = ''
  private readonly onChosen: (choice: DialogueChoice) => void
  private readonly onTalk: (npcId: string) => void
  private readonly questActions?: QuestActions
  private readonly intimidation?: IntimidationActions
  private readonly intimidatedDays: Record<string, number>
  private readonly advice?: AdviceActions
  private readonly adviceDays: Record<string, number>
  private readonly prepareDialogue: (definition: DialogueDefinition) => DialogueDefinition

  /**
   * Initialize the DialogueService instance and its collaborators.
   * @param {(containerId: string) => void} openBarter - The open barter supplied to this operation.
   * @param {QuestActions | undefined} questActions - The quest actions supplied to this operation.
   * @param {(npcId: string) => void} onTalk - The on talk supplied to this operation.
   * @param {(choice: DialogueChoice) => void} onChosen - The on chosen supplied to this operation.
   * @param {IntimidationActions | undefined} intimidation - The intimidation supplied to this operation.
   * @param {AdviceActions | undefined} advice - The advice supplied to this operation.
   * @param {(definition: DialogueDefinition) => DialogueDefinition} prepareDialogue - The prepare dialogue supplied to this operation.
   * @returns {DialogueService} The initialized instance.
   */
  constructor(
    openBarter: (containerId: string) => void = () => { },
    questActions?: QuestActions,
    onTalk: (npcId: string) => void = () => { },
    onChosen: (choice: DialogueChoice) => void = () => { },
    intimidation?: IntimidationActions,
    advice?: AdviceActions,
    prepareDialogue: (definition: DialogueDefinition) => DialogueDefinition = definition => definition
  ) {
    super({ conversation: null })
    this.openBarter = openBarter
    this.prepareDialogue = prepareDialogue
    this.questActions = questActions
    this.onTalk = onTalk
    this.onChosen = onChosen
    this.intimidation = intimidation
    this.intimidatedDays = { ...intimidation?.saved }
    this.advice = advice
    this.adviceDays = { ...advice?.saved }
  }

  /**
   * Save state.
   * @returns {Readonly<Record<string, number>>} The result described by the TypeScript return signature.
   */
  saveState = (): Readonly<Record<string, number>> => ({ ...this.intimidatedDays })

  /**
   * Save advice state.
   * @returns {Readonly<Record<string, number>>} The result described by the TypeScript return signature.
   */
  saveAdviceState = (): Readonly<Record<string, number>> => ({ ...this.adviceDays })

  /**
   * Check whether intimidate is allowed.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  private canIntimidate = (): boolean => Boolean(this.npcId && this.intimidation
    && !this.investigating && this.nodeId === this.definition?.start
    && this.intimidatedDays[this.npcId] !== this.intimidation.day())

  /**
   * Perform refuses dialogue for DialogueService.
   * @param {string} npcId - The npc id supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  private refusesDialogue = (npcId: string): boolean => Boolean(npcId && this.intimidation
    && this.intimidatedDays[npcId] === this.intimidation.day())

  /**
   * Open dialogue.
   * @param {string} npcName - The npc name supplied to this operation.
   * @param {DialogueDefinition} definition - The definition supplied to this operation.
   * @param {string} npcId - The npc id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  openDialogue = (npcName: string, definition: DialogueDefinition, npcId = ''): void => {
    if (this.refusesDialogue(npcId)) {
      this.closeDialogue()
      this.intimidation!.notify("This person doesn't want to talk to you now. Try later.")

      return
    }

    if (!definition.nodes[definition.start]) return

    definition = this.prepareDialogue(definition)
    this.definition = this.withOpeningLine(definition, npcId || npcName)
    this.investigating = false
    this.navigation.reset()
    this.npcId = npcId
    this.showNode(npcName, definition.start)
    this.onTalk(npcId)
  }

  /**
   * Cycle an NPC's authored openings, keeping the selected line for this conversation.
   * @param {DialogueDefinition} definition - Prepared dialogue with its original choices.
   * @param {string} npcKey - NPC identity used to track the next opening within this session.
   * @returns {DialogueDefinition} Conversation-local text without mutating shared content.
   */
  private withOpeningLine(definition: DialogueDefinition, npcKey: string): DialogueDefinition {
    const lines = definition.openingLines
    if (!lines?.length) return definition

    const index = (this.openingIndexes.get(npcKey) ?? 0) % lines.length
    this.openingIndexes.set(npcKey, (index + 1) % lines.length)

    return {
      ...definition,
      nodes: {
        ...definition.nodes,
        [definition.start]: { ...definition.nodes[definition.start], text: lines[index] },
      },
    }
  }

  /**
   * Open investigation.
   * @param {string} [npcId] - Missing person whose portrait accompanies the notice.
   * @param {DialogueDefinition} definition - The definition supplied to this operation.
   * @param {{ canChoose(id: string): boolean; choose(id: string): boolean; } | undefined} actions - The actions supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  openInvestigation = (
    definition: DialogueDefinition,
    actions?: {
      canChoose(id: string): boolean
      choose(id: string): boolean
    },
    npcId = ''
  ): void => {
    this.investigationActions = actions
    if (!definition.nodes[definition.start]) return

    this.definition = definition
    this.npcId = npcId
    this.investigating = true
    this.navigation.reset()
    this.showNode('Investigation', definition.start)
  }

  /**
   * Perform choose reply for DialogueService.
   * @param {string} choiceId - The choice id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  chooseReply = (choiceId: string): void => {
    const conversation = this.snapshot.conversation
    if (!conversation || !this.definition) return

    if (!this.investigating && choiceId === 'goodbye') {
      this.closeDialogue()

      return
    }

    if (this.refusesDialogue(this.npcId)) {
      if (choiceId === 'goodbye') this.closeDialogue()

      return
    }

    if (choiceId === INTIMIDATE_MONEY.id) {
      if (!this.canIntimidate()) return

      const actions = this.intimidation!
      const amount = intimidationPayment(actions.skill())
      if (!actions.pay(amount)) {
        actions.notify('Not enough inventory space for the Thalers.')

        return
      }

      this.intimidatedDays[this.npcId] = actions.day()
      this.onChosen(INTIMIDATE_MONEY)
      actions.notify(`${conversation.npcName} hands over ${amount} Thalers.`)
      this.publish({
        conversation: {
          npcName: conversation.npcName,
          npcId: this.npcId,
          trust: this.questActions?.getTrust?.(this.npcId) ?? 0,
          text: "All right, all right! Take it. Just leave me alone.",
          choices: [{ id: 'goodbye', text: 'Goodbye.' }]
        }
      })

      return
    }

    const authored = this.definition.nodes[this.nodeId]?.choices ?? []
    const back = this.investigating ? undefined
      : this.navigation.getBackChoice(authored.filter(this.canChoose))
    if (back && choiceId === back.id) {
      this.showNode(conversation.npcName, back.next!)

      return
    }

    const choice = authored.find(reply => reply.id === choiceId)
    if (!choice || !this.canChoose(choice)) return
    if (!this.meetsRequirements(choice)) {
      if (choice.requirementFailureText) {
        this.showNode(conversation.npcName, this.nodeId, choice.requirementFailureText)
      }
      return
    }

    if (this.investigating && this.investigationActions && !this.investigationActions.choose(choiceId)) return
    // Opening another coordinated window can close this investigation during its action.
    if (!this.definition) return

    if (choice.questId && !this.questActions?.choose(this.npcId, choice)) return

    if (choice.acceptQuestId && !this.questActions?.acceptFromNpc?.(choice.acceptQuestId, this.npcId)) return

    if (!this.investigating) this.visited.add(this.npcId + ':' + this.nodeId + ':' + choice.id)

    if (this.advice && choice.next === 'advice' && this.definition.nodes.advice) {
      const entry = chooseAdvice(this.advice.config, this.advice.skill(), this.advice.random)
      this.adviceDays[this.npcId] = this.advice.day()
      this.onChosen(choice.approach ? choice : { ...choice, approach: 'persuasion' })
      this.advice.onAsked()
      this.showNode(
        conversation.npcName,
        'advice',
        `[${entry.rarity.charAt(0).toUpperCase() + entry.rarity.slice(1)} advice] ${entry.text}`
      )

      return
    }

    if (!this.investigating) this.onChosen(choice)

    const barter = choice.barterId ? this.definition.barters?.find(barter => barter.id === choice.barterId) : this.definition.barter
    if (choice?.barter && barter) {
      const containerId = barter.id
      this.closeDialogue()
      this.openBarter(containerId)

      return
    }

    const next = advanceDialogue(this.definition, this.nodeId, choiceId)
    if (next === null) this.closeDialogue()
    else this.showNode(
      conversation.npcName,
      next,
      choice.acceptQuestId || ['courier-pickup', 'find-item-start'].includes(choice.id)
        ? this.questActions?.describeQuest?.(choice.acceptQuestId ?? choice.questId ?? '') : undefined
    )
  }

  /**
   * Close dialogue.
   * @returns {void} Completes the operation without returning a value.
   */
  closeDialogue = (): void => {
    if (!this.snapshot.conversation) return

    this.definition = undefined
    this.nodeId = ''
    this.npcId = ''
    this.navigation.reset()
    this.publish({ conversation: null })
  }

  /**
   * Perform show node for DialogueService.
   * @param {string} npcName - The npc name supplied to this operation.
   * @param {string} nodeId - The node id supplied to this operation.
   * @param {string | undefined} response - The response supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  private showNode(
    npcName: string,
    nodeId: string,
    response?: string
  ): void {
    const node = this.definition!.nodes[nodeId]
    if (!this.investigating) this.navigation.visit(nodeId)
    this.nodeId = nodeId
    const choices = [
      ...node.choices.filter(this.canChoose),
      ...(this.canIntimidate() ? [INTIMIDATE_MONEY] : [])
    ]
    const back = this.investigating ? undefined : this.navigation.getBackChoice(choices)
    if (back) choices.push(back)
    if (!this.investigating && !choices.some(choice => choice.id === 'goodbye')) {
      choices.push({ id: 'goodbye', text: 'Goodbye.', close: true })
    }

    const ordered = this.investigating ? choices : orderNpcChoices(choices, this.definition!, this.questActions?.isRepeatable)
    this.publish({
      conversation: {
        ...(this.investigating ? { kind: 'investigation' as const } : {}),
        npcName,
        npcId: this.investigating ? this.npcId || undefined : this.npcId,
        trust: this.investigating ? undefined : this.questActions?.getTrust?.(this.npcId) ?? 0,
        text: response ?? node.text,
        choices: ordered.map(choice => {
          let text = choice.text
          if (this.advice && choice.id === 'advice') text = `[Persuade ${this.advice.skill()}] Could you share some advice?`
          else if (this.advice && choice.approach === 'persuasion') text = text.replace('[Persuade]', `[Persuade ${this.advice.skill()}]`)

          if (this.intimidation && choice.approach === 'intimidation') text = text.replace('[Intimidate]', `[Intimidate ${this.intimidation.skill()}]`)

          return {
            id: choice.id,
            text: formatChoiceRequirements(
              choice, text, this.questActions?.getTrust?.(this.npcId) ?? 0,
              this.choiceSkill(choice),
            ),
            ...(this.isChoiceVisited(choice) ? { visited: true } : {})
          }
        }),
      }
    })
  }

  /**
   * Derive greyed reply styling from selection history and remaining nested questions.
   * @param {DialogueChoice} choice - Displayed reply in the current conversation node.
   * @returns {boolean} Whether the reply's visible branch has been fully explored.
   */
  private isChoiceVisited(choice: DialogueChoice): boolean {
    if (this.investigating || !this.definition) return false

    return isChoiceExhausted(
      this.definition, this.nodeId, choice,
      (nodeId, reply) => this.visited.has(`${this.npcId}:${nodeId}:${reply.id}`),
      this.canChoose,
    )
  }

  /**
   * Perform choice skill for DialogueService.
   * @param {DialogueChoice} choice - The choice supplied to this operation.
   * @returns {number} The calculated numeric result.
   */
  private choiceSkill(choice: DialogueChoice): number {
    const skill = choice.skillRequirement?.skill
    if (skill && this.questActions?.skill) return this.questActions.skill(skill)

    if (skill === 'intimidation') return this.intimidation?.skill() ?? 0
    if (skill === 'persuasion') return this.advice?.skill() ?? 0

    return 0
  }

  /**
   * Recheck social and skill thresholds before a reply can trigger any effects.
   * @param {DialogueChoice} choice - Authored reply with optional independent requirements.
   * @returns {boolean} Whether current NPC trust and effective skills satisfy both checks.
   */
  private meetsRequirements(choice: DialogueChoice): boolean {
    const trust = this.questActions?.getTrust?.(this.npcId) ?? 0

    return trust >= (choice.trustRequirement ?? 0)
      && (!choice.skillRequirement || this.choiceSkill(choice) >= choice.skillRequirement.level)
  }

  /**
   * Check whether choose is allowed.
   * @param {DialogueChoice} choice - The choice supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  private canChoose = (choice: DialogueChoice): boolean => {
    if (!this.investigating && this.questActions?.canChooseStory
      && !this.questActions.canChooseStory(choice)) return false
    if (this.investigating && this.investigationActions && !this.investigationActions.canChoose(choice.id)) return false

    if (!this.investigating && choice.id === 'goodbye') return true

    if (!this.investigating && choice.approach === 'intimidation') return false

    const offeredQuest = this.definition?.nodes[choice.next ?? '']?.choices.find(reply => reply.acceptQuestId)?.acceptQuestId
    if (offeredQuest && this.questActions?.canOffer
      && !this.questActions.canOffer(offeredQuest, this.npcId)) return false

    if (this.advice && choice.id === 'persuade-advice'
      && this.definition?.nodes[this.nodeId]?.choices.some(reply => reply.id === 'advice')) return false

    if (this.advice && choice.next === 'advice' && (!this.npcId || this.adviceDays[this.npcId] === this.advice.day())) return false

    if (choice.requiresQuest && !this.questActions?.isCompleted?.(choice.requiresQuest)) return false

    if (choice.acceptQuestId
      && !this.questActions?.canOffer?.(choice.acceptQuestId, this.npcId)) return false

    if (choice.questTopic) return Boolean(
      this.definition?.nodes[choice.next ?? '']?.choices.some(reply =>
        reply.questId === choice.questTopic && this.canChoose(reply))
    )

    return !choice.questId || Boolean(this.questActions?.canChoose(this.npcId, choice))
  }
}

