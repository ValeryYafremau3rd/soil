import { difficultyRules } from '../../../content/difficulty'
import { buffVitals } from '../../../domain/character/perks'
import type { Character } from '../../../domain/skills/character'
import { resolveEffectiveCharacter } from '../../../domain/skills/condition'
import { itemBuffMultiplier } from '../../../domain/skills/effects'
import { attributeVitals } from '../../../domain/skills/vitals'
import type { VitalConfig } from '../../contracts/status'
import { PerksService } from '../../services/character/PerksService'
import { StatusService } from '../../services/character/StatusService'

import type { InventoryService } from '../../services/inventory/InventoryService'

/** Live character and service readers used to refresh capacity without healing. */
interface LimitSetup {
  getCharacter: () => Character | null
  getDifficulty: () => ReturnType<typeof difficultyRules>
  currentCharacter: () => Character | null
  inventory: InventoryService
  status: StatusService
  perks: PerksService
  definitions: Parameters<typeof resolveEffectiveCharacter>[2]
}

/**
 * Subscribe effective vital limits to equipment, condition and perk changes.
 * @param {LimitSetup} setup - Live character rules and subscribing stores.
 * @returns {void} Installs reentrancy-guarded subscriptions for the session lifetime.
 */
export function observeCharacterLimits({
  getCharacter, getDifficulty, currentCharacter, inventory, status, perks, definitions,
}: LimitSetup): void {
  let updatingLimits = false

  /**
   * Update vital limits.
   * @returns {void} Completes the operation without returning a value.
   */
  const updateVitalLimits = (): void => {
    const character = getCharacter()
    if (!character || updatingLimits) return

    updatingLimits = true
    try {
      const skills = currentCharacter()!.skills
      const effective = resolveEffectiveCharacter(
        character,
        inventory.getBonusItems(),
        definitions,
        status.getSnapshot(),
        status.getLimits(),
        perks.getSnapshot(),
        perks.buffDefinitions,
        perks.definitions,
        false,
        skills
      )
      status.setLimits(buffVitals(
        attributeVitals(getDifficulty().stats as VitalConfig[], effective.attributes),
        perks.getSnapshot(),
        perks.buffDefinitions,
        itemBuffMultiplier(skills)
      ))
      inventory.syncLegendaryStock()
    } finally {
      updatingLimits = false
    }
  }
  status.subscribe(updateVitalLimits)
  inventory.subscribe(updateVitalLimits)
  perks.subscribe(updateVitalLimits)
}
