import type { ContainerSeed, VendorStock } from '../inventory/loot'
import type { Character } from '../skills/character'

export const ADVICE_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const
export type AdviceRarity = typeof ADVICE_RARITIES[number]
/**
 * Authored advice content and conditions for presenting it.
 */
export interface AdviceEntry {
  id: string
  rarity: AdviceRarity
  level: number
  text: string
}
/**
 * Authored advice entries and the settings controlling their selection.
 */
export interface AdviceConfiguration {
  entries: readonly AdviceEntry[]
}

/**
 * Advice always succeeds; Persuasion expands the available pool.
 * @param {AdviceConfiguration} config - Configuration consumed by this operation.
 * @param {number} persuasion - The persuasion supplied to this operation.
 * @param {() => number} random - Random-number source; injectable for deterministic results.
 * @returns {AdviceEntry} The result described by the TypeScript return signature.
 */
export function chooseAdvice(
  config: AdviceConfiguration,
  persuasion: number,
  random: () => number = Math.random
): AdviceEntry {
  const level = Number.isFinite(persuasion) ? Math.max(1, Math.min(20, persuasion)) : 1
  const entries = config.entries.filter(entry => entry.level <= level)
  const roll = Math.max(0, Math.min(1 - Number.EPSILON, random()))

  return entries[Math.floor(roll * entries.length)]
}

export const INTIMIDATE_MONEY: DialogueChoice = {
  id: 'intimidate-money',
  text: '[Intimidate] Hand over your Thalers. Now.',
  approach: 'intimidation',
}

/**
 * Perform intimidation payment.
 * @param {number} skill - The skill supplied to this operation.
 * @returns {number} The calculated numeric result.
 */
export function intimidationPayment(skill: number): number {
  return Number.isFinite(skill) ? Math.max(0, Math.floor(skill / 2)) : 0
}

/**
 * Player reply with conditions, actions and an optional next dialogue node.
 */
export interface DialogueChoice {
  storyConditions?: Readonly<Record<string, boolean | string>>
  storyDecision?: { id: string; value: string }
  questChoiceId?: string
  questTopic?: string
  requirementFailureText?: string
  trustRequirement?: number
  skillRequirement?: {
    skill: keyof Character['skills']
    level: number
  }
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

/**
 * NPC dialogue text and the player choices available at that point.
 */
export interface DialogueNode {
  text: string
  choices: readonly DialogueChoice[]
}

/**
 * Authored dialogue graph with optional barter and interaction rules.
 */
export interface DialogueDefinition {
  openingLines?: readonly string[]
  barter?: ContainerSeed & {
    stock?: VendorStock
  }
  barters?: readonly (ContainerSeed & {
    stock?: VendorStock
  })[]
  start: string
  nodes: Readonly<Record<string, DialogueNode>>
}

/**
 * Perform order npc choices.
 * @param {readonly DialogueChoice[]} choices - The choices supplied to this operation.
 * @param {DialogueDefinition} definition - The definition supplied to this operation.
 * @param {(questId: string) => boolean} isRepeatable - The is repeatable supplied to this operation.
 * @returns {DialogueChoice[]} The result described by the TypeScript return signature.
 */
export function orderNpcChoices(
  choices: readonly DialogueChoice[],
  definition: DialogueDefinition,
  isRepeatable: (questId: string) => boolean = () => false
): DialogueChoice[] {
  /**
   * Perform priority.
   * @param {DialogueChoice} choice - The choice supplied to this operation.
   * @returns {number} The calculated numeric result.
   */
  const priority = (choice: DialogueChoice): number => {
    if (choice.barter) return 0

    if (choice.close || choice.id === 'goodbye') return 5

    if (choice.approach || choice.next === 'advice') return 4

    const questId = choice.questId ?? choice.acceptQuestId ?? choice.questTopic
      ?? definition.nodes[choice.next ?? '']?.choices.find(reply => reply.acceptQuestId)?.acceptQuestId
    if (questId) return isRepeatable(questId) ? 3 : 1

    return 2
  }

  return [...choices].sort((a, b) => priority(a) - priority(b))
}

/**
 * Perform advance dialogue.
 * @param {DialogueDefinition} definition - The definition supplied to this operation.
 * @param {string} nodeId - The node id supplied to this operation.
 * @param {string} choiceId - The choice id supplied to this operation.
 * @returns {string | null} The result described by the TypeScript return signature.
 */
export function advanceDialogue(
  definition: DialogueDefinition,
  nodeId: string,
  choiceId: string
): string | null {
  const choice = definition.nodes[nodeId]?.choices.find(reply => reply.id === choiceId)
  if (choice?.close) return null

  return choice?.next && definition.nodes[choice.next] ? choice.next : nodeId
}
