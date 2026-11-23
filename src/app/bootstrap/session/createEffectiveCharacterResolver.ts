import type { InventoryItemDefinition } from '../../../domain/inventory/items'
import type { Character } from '../../../domain/skills/character'
import { resolveEffectiveCharacter } from '../../../domain/skills/condition.ts'
import type { InventoryController } from '../../contracts/inventory'
import type { PerksController } from '../../contracts/perks'
import type { StatusController } from '../../contracts/status'

/** Lazily accessed state avoids changing circular service initialization order. */
interface CharacterSources {
  getCharacter: () => Character | null
  getInventory: () => Pick<InventoryController, 'getSnapshot' | 'getBonusItems'>
  getStatus: () => Pick<StatusController, 'getSnapshot' | 'getLimits'>
  getPerks: () => PerksController
  definitions: Readonly<Record<string, InventoryItemDefinition>>
}

/**
 * Cache effective character rules by the identity of their observable inputs.
 * @param {CharacterSources} sources - Lazy readers and authored item rules.
 * @returns {() => Character | null} Current character with carried and temporary effects.
 */
export function createEffectiveCharacterResolver({
  getCharacter, getInventory, getStatus, getPerks, definitions,
}: CharacterSources): () => Character | null {
  let characterCache: {
    inputs: readonly unknown[]
    value: Character
  } | undefined

  /**
   * Perform current character.
   * @returns {Character | null} The result described by the TypeScript return signature.
   */
  return (): Character | null => {
    const character = getCharacter()
    if (!character) return null

    const inventory = getInventory()
    const status = getStatus()
    const perks = getPerks()

    const inputs = [
      character,
      inventory.getSnapshot(),
      status.getSnapshot(),
      status.getLimits(),
      perks.getSnapshot()
    ]
    if (characterCache && inputs.every((value, index) => value === characterCache!.inputs[index])) return characterCache.value

    const value = resolveEffectiveCharacter(
      character,
      inventory.getBonusItems(),
      definitions,
      status.getSnapshot(),
      status.getLimits(),
      perks.getSnapshot(),
      perks.buffDefinitions,
      perks.definitions
    )
    characterCache = { inputs, value }

    return value
  }

}
