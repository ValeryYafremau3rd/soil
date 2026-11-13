import type { BuildingDefinition,ContainerConfiguration,FurnitureConfiguration,ItemDefinition,NpcDefinition,PatrolConfiguration,RoomDefinition,TaskboardConfiguration } from '../../../content/types'
import type { DifficultyConfiguration } from '../../../domain/character/difficulty'
import type { AdviceConfiguration,DialogueDefinition } from '../../../domain/dialogue/dialogue'
import type { QuestDefinition } from '../../../domain/quests/quests'
import type { SkillAttributeWeights } from '../../../domain/skills/character'
import type { TravelLocation } from '../../contracts/travel'
import type { ContentInput } from '../contentInput.ts'

export function contentContext(input: ContentInput) {
const advice = input.advice as AdviceConfiguration
const weights = (input.skills as { attributeWeights: SkillAttributeWeights }).attributeWeights
const difficulty = input.difficulty as DifficultyConfiguration
const buildings = input.buildings as Record<string, BuildingDefinition>
const rooms = input.rooms as Record<string, RoomDefinition>
const furniture = input.furniture as FurnitureConfiguration
const npcs = input.npcs as Record<string, NpcDefinition>
const patrols = input.patrols as PatrolConfiguration
const containers = input.containers as ContainerConfiguration
const taskboards = input.taskboards as TaskboardConfiguration
const locations = input.locations as TravelLocation[]
const dialogues = input.dialogues as Record<string, DialogueDefinition>
const quests = input.quests as QuestDefinition[]
const items = input.items as ItemDefinition[]
const perks = (input.ui as { perks: import('../../../domain/character/perks').PerkDefinition[] }).perks
const buffs = (input.ui as { consumableBuffs: import('../../../domain/character/perks').ConsumableBuffDefinition[] }).consumableBuffs
const findRewards = (input.daytime as { findItemRewardMultipliers: Record<string, number> }).findItemRewardMultipliers
const legendary = (input.skills as { legendary: { perks: { skill: string }[]; scrapping: { fallbackReward: { itemId: string; minQuantity: number; maxQuantity: number } }; barter: { vendorId: string; minItems: number; maxItems: number; ammunition: { itemId: string; quantity: number } } } }).legendary
const scrapping = (input.skills as { scrapping: { baseChance: number; maxChance: number; rewards: { itemId: string; quantity: number }[] } }).scrapping
const lockSums = (input.skills as { lockpickingMaxSumByRarity: Record<string, number> }).lockpickingMaxSumByRarity
const hero = input.hero as { asset: { referenceWidth: number }; actions: Record<string, string>;
    steps: Record<string, { x: number; y: number; width: number; height: number; anchorX?: number; anchorY?: number;
      excludeRegions?: { x: number; y: number; width: number; height: number }[] }[]>;
    animations: Record<string, { frameRate?: number; durationMs?: number; repeat: number }>; settings: { edgeMargin: number;
      attackTiming: { minDamageMultiplier: number; maxDamageMultiplier: number; radius: number; dotRadius: number } } }
const ui = input.ui as { itemSheet: { width: number; height: number }; menus: { id: string; key: string }[];
    stats: { id: string; value: number; max: number }[] }
const layers = (input.settings as { layers: Record<string, number> }).layers
const initialTime = input.daytime as { initialPhase: string; initialPhaseTravels: number; travelsPerPhase: number; nightDurationMultiplier: number }
const daytime = input.daytime as { courierJobsPerDay: { min: number; max: number }; iconSheet: { width: number; height: number }; phases: Record<string, { icon: { x: number; y: number; width: number; height: number } }> }
return { input, advice, weights, difficulty, buildings, rooms, furniture, npcs, patrols, containers, taskboards, locations, dialogues, quests, items, itemIds: new Set(items.map(item => item.id)), perks, buffs, findRewards, legendary, scrapping, lockSums, hero, ui, layers, initialTime, daytime }
}
export type ContentContext = ReturnType<typeof contentContext>
