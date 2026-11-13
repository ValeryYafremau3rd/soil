import type { ContainerSeed, VendorStock } from '../inventory/loot'

export const ADVICE_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const
export type AdviceRarity = typeof ADVICE_RARITIES[number]
export interface AdviceEntry { id: string; rarity: AdviceRarity; level: number; text: string }
export interface AdviceConfiguration {
  entries: readonly AdviceEntry[]
}

/** Advice always succeeds; Persuasion expands the available pool. */
export function chooseAdvice(config: AdviceConfiguration, persuasion: number, random: () => number = Math.random): AdviceEntry {
  const level = Number.isFinite(persuasion) ? Math.max(1, Math.min(20, persuasion)) : 1
  const entries = config.entries.filter(entry => entry.level <= level)
  const roll = Math.max(0, Math.min(1 - Number.EPSILON, random()))
  return entries[Math.floor(roll * entries.length)]
}

export const INTIMIDATE_MONEY: DialogueChoice = {
  id: 'intimidate-money', text: '[Intimidate] Hand over your Thalers. Now.', approach: 'intimidation',
}

export function intimidationPayment(skill: number): number {
  return Number.isFinite(skill) ? Math.max(0, Math.floor(skill / 2)) : 0
}

export interface DialogueChoice {
  approach?: 'persuasion' | 'intimidation'
  id: string
  text: string
  next?: string
  close?: boolean
  barter?: boolean
  questId?: string
  acceptQuestId?: string
  requiresQuest?: string
  barterId?: string
}

export interface DialogueNode {
  text: string
  choices: readonly DialogueChoice[]
}

export interface DialogueDefinition {
  barter?: ContainerSeed & { stock?: VendorStock }
  barters?: readonly (ContainerSeed & { stock?: VendorStock })[]
  start: string
  nodes: Readonly<Record<string, DialogueNode>>
}

export function orderNpcChoices(choices: readonly DialogueChoice[], definition: DialogueDefinition,
  isRepeatable: (questId: string) => boolean = () => false): DialogueChoice[] {
  const priority = (choice: DialogueChoice): number => {
    if (choice.barter) return 0
    if (choice.close || choice.id === 'goodbye') return 5
    if (choice.approach || choice.next === 'advice') return 4
    const questId = choice.questId ?? choice.acceptQuestId
      ?? definition.nodes[choice.next ?? '']?.choices.find(reply => reply.acceptQuestId)?.acceptQuestId
    if (questId) return isRepeatable(questId) ? 3 : 1
    return 2
  }
  return [...choices].sort((a, b) => priority(a) - priority(b))
}

export function advanceDialogue(definition: DialogueDefinition, nodeId: string, choiceId: string): string | null {
  const choice = definition.nodes[nodeId]?.choices.find(reply => reply.id === choiceId)
  if (choice?.close) return null
  return choice?.next && definition.nodes[choice.next] ? choice.next : nodeId
}
