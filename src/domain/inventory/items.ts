import { itemBuffMultiplier, scaleItemBuff } from '../skills/effects.ts'
import { calculateSkills } from '../skills/character.ts'
import type { Attributes, Character } from '../skills/character'
import type { ItemStack } from './loot'
import skillConfig from '../../content/skills.json' with { type: 'json' }

export const EQUIPMENT_SLOTS = ['ranged', 'melee', 'tool', 'armor', 'shoes', 'accessory', 'amulet', 'bag'] as const
export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number]
export type Equipment = Partial<Record<EquipmentSlot, string>>

/**
 * Perform equipment items.
 * @param {Partial<Record<"melee" | "ranged" | "tool" | "armor" | "shoes" | "accessory" | "amulet" | "bag", string>>} equipment - The equipment supplied to this operation.
 * @returns {ItemStack[]} The result described by the TypeScript return signature.
 */
export function equipmentItems(equipment: Equipment = {}): ItemStack[] {
  return Object.values(equipment).map(itemId => ({ itemId, quantity: 1 }))
}

/**
 * Equipment requires a slot; other carried items keep their passive effects.
 * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
 * @param {Partial<Record<"melee" | "ranged" | "tool" | "armor" | "shoes" | "accessory" | "amulet" | "bag", string>>} equipment - The equipment supplied to this operation.
 * @param {Readonly<Record<string, InventoryItemDefinition>>} definitions - Authored definitions used to resolve identifiers and rules.
 * @returns {ItemStack[]} The result described by the TypeScript return signature.
 */
export function activeBonusItems(
  items: readonly ItemStack[],
  equipment: Equipment,
  definitions: Readonly<Record<string, InventoryItemDefinition>>
): ItemStack[] {
  return [
    ...items.filter(item => !definitions[item.itemId]?.equipmentSlot && !definitions[item.itemId]?.readable),
    ...equipmentItems(equipment)
  ]
}

/**
 * Compatibility aliases for parcels used by older route-specific saves.
 * @param {string} id - The id supplied to this operation.
 * @returns {string} The resolved text value.
 */
export function deliveryItemId(id: string): string {
  if (/^courier-.*-parcel$/.test(id)) return 'courier-parcel'

  if (['smuggled-parts', 'smuggled-ledger', 'smuggled-core'].includes(id)) return 'smuggler-parcel'

  return id
}
export type Vital = 'health' | 'energy' | 'sanity'
export const ITEM_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const
export type ItemRarity = typeof ITEM_RARITIES[number]
export type Recovery = Partial<Record<Vital, number>>
export type ItemBonus = {
  attribute: keyof Attributes
  amount: number
} |
{
  skill: keyof ReturnType<typeof calculateSkills>
  amount: number
}
export type ItemSkills = Partial<Character['skills']>
export type ItemSkillRequirements = Partial<Record<Exclude<keyof Character['skills'], 'erudition'>, number>>

/**
 * Perform understands item.
 * @param {InventoryItemDefinition} item - The item supplied to this operation.
 * @param {number} erudition - The erudition supplied to this operation.
 * @param {Partial<Skills>} skills - The skills supplied to this operation.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
export function understandsItem(
  item: InventoryItemDefinition,
  erudition: number,
  skills: ItemSkills = {}
): boolean {
  return unmetItemRequirements(item, { ...skills, erudition }).length === 0
}

/**
 * Perform effective requirements.
 * @param {InventoryItemDefinition} item - The item supplied to this operation.
 * @param {Partial<Skills>} skills - The skills supplied to this operation.
 * @returns {Partial<Skills>} The result described by the TypeScript return signature.
 */
function effectiveRequirements(
  item: InventoryItemDefinition,
  skills: ItemSkills
): ItemSkills {
  const multiplier = Math.max(
    0,
    1 - Math.max(0, skills.erudition ?? 0) * skillConfig.educationRequirementReduction
  )

  return {
    ...(item.eruditionRequired === undefined ? {} : { erudition: item.eruditionRequired }),
    ...Object.fromEntries(Object.entries(item.skillRequirements ?? {}).map(([skill, value]) => [skill, Math.ceil(value * multiplier)]))
  }
}
/**
 * Engine-independent item rules for requirements, equipment, bonuses and use.
 */
export interface InventoryItemDefinition {
  category?: string
  equipmentSlot?: EquipmentSlot
  id: string
  eruditionRequired?: number
  skillRequirements?: ItemSkillRequirements
  requirementMode?: 'any'
  price?: number
  rarity?: ItemRarity
  quality?: number
  inventorySlots?: number
  patrolPass?: boolean
  saleable?: boolean
  randomLoot?: boolean
  keys?: readonly {
    id: string
    name: string
    doorId: string
  }[]
  attachToKeyRing?: boolean
  readingText?: string
  readable?: boolean
  consumable?: boolean
  scrap?: boolean
  maxStack?: number
  bonus?: ItemBonus
  bonuses?: readonly ItemBonus[]
  stealthModifier?: number
  damageResistance?: number
  fearResistance?: number
  recovery?: Recovery
  ammunition?: boolean
  firearm?: {
    ammunitionId: string
  }
  damageMultiplier?: number
}

/**
 * Perform item weapon kind.
 * @param {InventoryItemDefinition} item - The item supplied to this operation.
 * @returns {"melee" | "shot" | undefined} The result described by the TypeScript return signature.
 */
export function itemWeaponKind(item: InventoryItemDefinition): 'melee' | 'shot' | undefined {
  if (item.firearm) return 'shot'

  if (item.damageMultiplier !== undefined) return 'melee'

  return undefined
}

/**
 * Perform unmet item requirements.
 * @param {InventoryItemDefinition} item - The item supplied to this operation.
 * @param {Partial<Skills>} skills - The skills supplied to this operation.
 * @returns {object} The result described by the TypeScript return signature.
 */
export function unmetItemRequirements(
  item: InventoryItemDefinition,
  skills: ItemSkills
): {
  skill: keyof Character['skills']
  required: number
  current: number
}[] {
  const requirements = effectiveRequirements(item, skills)
  if (item.requirementMode === 'any' && Object.entries(requirements).some(([skill, required]) => (skills[skill as keyof ItemSkills] ?? 1) >= required)) return []

  return (Object.entries(requirements) as [keyof Character['skills'], number][])
    .filter(([skill, required]) => (skills[skill] ?? 1) < required)
    .map(([skill, required]) => ({ skill, required, current: skills[skill] ?? 1 }))
}

/**
 * Perform item bonuses.
 * @param {InventoryItemDefinition} item - The item supplied to this operation.
 * @returns {readonly ItemBonus[]} The result described by the TypeScript return signature.
 */
export function itemBonuses(item: InventoryItemDefinition): readonly ItemBonus[] {
  return [...(item.bonus ? [item.bonus] : []), ...(item.bonuses ?? [])]
}

/**
 * Perform item has stats.
 * @param {InventoryItemDefinition} item - The item supplied to this operation.
 * @returns {boolean} Whether the requested condition is satisfied.
 */
export function itemHasStats(item: InventoryItemDefinition): boolean {
  return itemBonuses(item).length > 0 || item.stealthModifier !== undefined
    || item.damageResistance !== undefined || item.fearResistance !== undefined
    || Object.keys(item.recovery ?? {}).length > 0 || item.damageMultiplier !== undefined
    || item.firearm !== undefined || item.inventorySlots !== undefined
}

/**
 * Perform item requirement states.
 * @param {InventoryItemDefinition} item - The item supplied to this operation.
 * @param {Partial<Skills>} skills - The skills supplied to this operation.
 * @returns {object} The result described by the TypeScript return signature.
 */
export function itemRequirementStates(
  item: InventoryItemDefinition,
  skills: ItemSkills
) {
  const entries = Object.entries(effectiveRequirements(item, skills))
    .filter((entry): entry is [keyof Character['skills'], number] => entry[1] !== undefined)
  const satisfied = entries.some(([skill, required]) => (skills[skill] ?? 1) >= required)

  return entries.map(([skill, required]) => ({
    skill,
    required,
    state: (skills[skill] ?? 1) >= required ? 'fulfilled' as const
      : item.requirementMode === 'any' && satisfied ? 'irrelevant' as const : 'unmet' as const
  }))
}

/** Learned sources are service-owned records, independent of carried inventory. */
export type ItemBonusSource = ItemStack & {
  learned?: boolean
}

/**
 * Each carried or learned item type contributes once, regardless of quantity.
 * @param {Character} character - Character whose attributes and skills are used.
 * @param {readonly ItemBonusSource[]} items - Item stacks to inspect or transform.
 * @param {Readonly<Record<string, InventoryItemDefinition>>} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {number} skillMultiplier - The skill multiplier supplied to this operation.
 * @param {number | Partial<Record<keyof Attributes, number>>} attributeMultiplier - The attribute multiplier supplied to this operation.
 * @param {number} itemMultiplier - The item multiplier supplied to this operation.
 * @returns {Character} The result described by the TypeScript return signature.
 */
export function applyCarriedBonuses(
  character: Character,
  items: readonly ItemBonusSource[],
  definitions: Readonly<Record<string, InventoryItemDefinition>>,
  skillMultiplier = 1,
  attributeMultiplier: number | Partial<Record<keyof Attributes, number>> = 1,
  itemMultiplier = 1
): Character {
  const attributes = { ...character.baseAttributes }

  /**
   * Perform effective attributes.
   * @returns {Attributes} The result described by the TypeScript return signature.
   */
  const effectiveAttributes = (): Attributes => Object.fromEntries(Object.entries(attributes)
    .map(([key, value]) => [key, Math.max(0, Math.floor(value * (typeof attributeMultiplier === 'number'
      ? attributeMultiplier : attributeMultiplier[key as keyof Attributes] ?? 1)))])) as unknown as Attributes
  const bonuses: ItemBonus[] = []

  /**
   * Perform resolved skills.
   * @returns {Skills} The result described by the TypeScript return signature.
   */
  const resolvedSkills = (): Character['skills'] => {
    const skills = calculateSkills(effectiveAttributes())

    for (const key of Object.keys(skills) as (keyof typeof skills)[]) skills[key] += character.skillModifiers?.[key] ?? 0

    for (const bonus of bonuses) if ('skill' in bonus) skills[bonus.skill] += bonus.amount

    skills.erudition = Math.min(20, skills.erudition)

    for (const key of Object.keys(skills) as (keyof typeof skills)[]) skills[key] = Math.max(1, Math.floor(skills[key] * skillMultiplier))

    return skills
  }
  const learned = new Set(items.filter(item => item.learned && item.quantity > 0).map(item => item.itemId))

  for (const id of new Set(items.filter(item => item.quantity > 0).map(item => item.itemId))) {
    const item = definitions[id]
    if (!item || item.readable && !learned.has(id) || item.consumable && !item.readable) continue

    if (item.stealthModifier) bonuses.push({
      skill: 'stealth',
      amount: scaleItemBuff(item.stealthModifier, itemMultiplier, item.category)
    })

    for (const source of itemBonuses(item)) {
      const bonus = {
        ...source,
        amount: item.readable ? source.amount : scaleItemBuff(source.amount, itemMultiplier, item.category)
      }
      bonuses.push(bonus)
      if ('attribute' in bonus) attributes[bonus.attribute] += bonus.amount
    }
  }

  const currentAttributes = effectiveAttributes()
  const skills = resolvedSkills()

  return { ...character, attributes: currentAttributes, skills }
}

export const VITAL_LABELS: Record<Vital, string> = { health: 'Health', energy: 'Energy', sanity: 'Sanity' }

/**
 * Carried symbolic items add percentage points once per type, capped at immunity.
 * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
 * @param {Readonly<Record<string, InventoryItemDefinition>>} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {Partial<Skills>} skills - Current effective character skills used to scale carried resistance bonuses.
 * @param {number} temporaryResistance - The temporary resistance supplied to this operation.
 * @returns {number} The calculated numeric result.
 */
export function resolveFearResistance(
  items: readonly ItemStack[],
  definitions: Readonly<Record<string, InventoryItemDefinition>>,
  skills: ItemSkills,
  temporaryResistance = 0
): number {
  let total = temporaryResistance

  for (const id of new Set(items.filter(item => item.quantity > 0).map(item => item.itemId))) {
    const item = definitions[id]
    if (item && !item.consumable) total += scaleItemBuff(item.fearResistance ?? 0, itemBuffMultiplier(skills), item.category)
  }

  return Math.max(0, Math.min(100, total))
}

/**
 * Resolve damage resistance from the supplied state.
 * @param {readonly ItemStack[]} items - Item stacks to inspect or transform.
 * @param {Readonly<Record<string, InventoryItemDefinition>>} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {Partial<Skills>} skills - Current effective character skills used to scale carried resistance bonuses.
 * @param {number} temporaryResistance - The temporary resistance supplied to this operation.
 * @returns {number} The calculated numeric result.
 */
export function resolveDamageResistance(
  items: readonly ItemStack[],
  definitions: Readonly<Record<string, InventoryItemDefinition>>,
  skills: ItemSkills,
  temporaryResistance = 0
): number {
  let total = temporaryResistance

  for (const id of new Set(items.filter(item => item.quantity > 0).map(item => item.itemId))) {
    const item = definitions[id]
    if (item && !item.consumable) total += scaleItemBuff(item.damageResistance ?? 0, itemBuffMultiplier(skills), item.category)
  }

  return Math.max(0, Math.min(100, total))
}
