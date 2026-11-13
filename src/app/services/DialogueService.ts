import { ObservableStore } from './ObservableStore.ts'
import type { DialogueController, DialogueSnapshot } from '../contracts/dialogue'
import type { AdviceConfiguration, DialogueChoice, DialogueDefinition } from '../../domain/dialogue/dialogue'
import { advanceDialogue, chooseAdvice, intimidationPayment, INTIMIDATE_MONEY, orderNpcChoices } from '../../domain/dialogue/dialogue.ts'

interface AdviceActions {
  config: AdviceConfiguration
  skill(): number
  day(): number
  onAsked(): void
  saved?: Readonly<Record<string, number>>
  random?: () => number
}

interface IntimidationActions {
  skill(): number
  day(): number
  pay(amount: number): boolean
  notify(message: string): void
  saved?: Readonly<Record<string, number>>
}

interface QuestActions {
  isRepeatable?(questId: string): boolean
  describeQuest?(questId: string): string | undefined
  canChoose(npcId: string, choice: DialogueChoice): boolean
  choose(npcId: string, choice: DialogueChoice): boolean
  canOffer?(questId: string, npcId: string): boolean
  acceptFromNpc?(questId: string, npcId: string): boolean
  isCompleted?(questId: string): boolean
  getTrust?(npcId: string): number
}

export class DialogueService extends ObservableStore<DialogueSnapshot> implements DialogueController {
  private definition?: DialogueDefinition
  private nodeId = ''
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

  constructor(openBarter: (containerId: string) => void = () => {},
    questActions?: QuestActions,
    onTalk: (npcId: string) => void = () => {}, onChosen: (choice: DialogueChoice) => void = () => {},
    intimidation?: IntimidationActions, advice?: AdviceActions) {
    super({ conversation: null })
    this.openBarter = openBarter
    this.questActions = questActions
    this.onTalk = onTalk
    this.onChosen = onChosen
    this.intimidation = intimidation
    this.intimidatedDays = { ...intimidation?.saved }
    this.advice = advice
    this.adviceDays = { ...advice?.saved }
  }

  saveState = (): Readonly<Record<string, number>> => ({ ...this.intimidatedDays })
  saveAdviceState = (): Readonly<Record<string, number>> => ({ ...this.adviceDays })

  private canIntimidate = (): boolean => Boolean(this.npcId && this.intimidation
    && !this.investigating && this.nodeId === this.definition?.start
    && this.intimidatedDays[this.npcId] !== this.intimidation.day())

  private refusesDialogue = (npcId: string): boolean => Boolean(npcId && this.intimidation
    && this.intimidatedDays[npcId] === this.intimidation.day())

  openDialogue = (npcName: string, definition: DialogueDefinition, npcId = ''): void => {
    if (this.refusesDialogue(npcId)) {
      this.closeDialogue()
      this.intimidation!.notify("This person doesn't want to talk to you now. Try later.")
      return
    }
    if (!definition.nodes[definition.start]) return
    this.definition = definition
    this.investigating = false
    this.npcId = npcId
    this.showNode(npcName, definition.start)
    this.onTalk(npcId)
  }

  openInvestigation = (definition: DialogueDefinition): void => {
    if (!definition.nodes[definition.start]) return
    this.definition = definition
    this.npcId = ''
    this.investigating = true
    this.showNode('Investigation', definition.start)
  }

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
      if (!actions.pay(amount)) { actions.notify('Not enough inventory space for the Thalers.'); return }
      this.intimidatedDays[this.npcId] = actions.day()
      this.onChosen(INTIMIDATE_MONEY)
      actions.notify(`${conversation.npcName} hands over ${amount} Thalers.`)
      this.publish({ conversation: { npcName: conversation.npcName,
        trust: this.questActions?.getTrust?.(this.npcId) ?? 0,
        text: "All right, all right! Take it. Just leave me alone.",
        choices: [{ id: 'goodbye', text: 'Goodbye.' }] } })
      return
    }
    const choice = this.definition.nodes[this.nodeId]?.choices.find(reply => reply.id === choiceId)
    if (!choice || !this.canChoose(choice)) return
    if (choice.questId && !this.questActions?.choose(this.npcId, choice)) return
    if (choice.acceptQuestId && !this.questActions?.acceptFromNpc?.(choice.acceptQuestId, this.npcId)) return
    if (this.advice && choice.next === 'advice' && this.definition.nodes.advice) {
      const entry = chooseAdvice(this.advice.config, this.advice.skill(), this.advice.random)
      this.adviceDays[this.npcId] = this.advice.day()
      this.onChosen(choice.approach ? choice : { ...choice, approach: 'persuasion' })
      this.advice.onAsked()
      this.showNode(conversation.npcName, 'advice', `[${entry.rarity.charAt(0).toUpperCase() + entry.rarity.slice(1)} advice] ${entry.text}`)
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
    else this.showNode(conversation.npcName, next, choice.acceptQuestId || ['courier-pickup', 'find-item-start'].includes(choice.id)
      ? this.questActions?.describeQuest?.(choice.acceptQuestId ?? choice.questId ?? '') : undefined)
  }

  closeDialogue = (): void => {
    if (!this.snapshot.conversation) return
    this.definition = undefined
    this.nodeId = ''
    this.npcId = ''
    this.publish({ conversation: null })
  }

  private showNode(npcName: string, nodeId: string, response?: string): void {
    const node = this.definition!.nodes[nodeId]
    this.nodeId = nodeId
    const choices = [...node.choices.filter(this.canChoose), ...(this.canIntimidate() ? [INTIMIDATE_MONEY] : [])]
    if (!this.investigating && !choices.some(choice => choice.id === 'goodbye')) {
      choices.push({ id: 'goodbye', text: 'Goodbye.', close: true })
    }
    const ordered = this.investigating ? choices : orderNpcChoices(choices, this.definition!, this.questActions?.isRepeatable)
    this.publish({ conversation: {
      ...(this.investigating ? { kind: 'investigation' as const } : {}),
      npcName, trust: this.investigating ? undefined : this.questActions?.getTrust?.(this.npcId) ?? 0, text: response ?? node.text, choices: ordered.map(choice => {
          let text = choice.text
          if (this.advice && choice.id === 'advice') text = `[Persuade ${this.advice.skill()}] Could you share some advice?`
          else if (this.advice && choice.approach === 'persuasion') text = text.replace('[Persuade]', `[Persuade ${this.advice.skill()}]`)
          if (this.intimidation && choice.approach === 'intimidation') text = text.replace('[Intimidate]', `[Intimidate ${this.intimidation.skill()}]`)
          return { id: choice.id, text }
        }),
    } })
  }

  private canChoose = (choice: DialogueChoice): boolean => {
    if (!this.investigating && choice.id === 'goodbye') return true
    if (!this.investigating && choice.approach === 'intimidation') return false
    const offeredQuest = this.definition?.nodes[choice.next ?? '']?.choices.find(reply => reply.acceptQuestId)?.acceptQuestId
    if (offeredQuest && this.questActions?.canOffer && !this.questActions.canOffer(offeredQuest, this.npcId)) return false
    if (this.advice && choice.id === 'persuade-advice'
      && this.definition?.nodes[this.nodeId]?.choices.some(reply => reply.id === 'advice')) return false
    if (this.advice && choice.next === 'advice' && (!this.npcId || this.adviceDays[this.npcId] === this.advice.day())) return false
    if (choice.requiresQuest && !this.questActions?.isCompleted?.(choice.requiresQuest)) return false
    if (choice.acceptQuestId && !this.questActions?.canOffer?.(choice.acceptQuestId, this.npcId)) return false
    return !choice.questId || Boolean(this.questActions?.canChoose(this.npcId, choice))
  }

}

