import { CLASSES } from '../../../content/classes'
import { DIALOGUES } from '../../../content/dialogues'
import { difficultyRules } from '../../../content/difficulty'
import { buffVitals } from '../../../domain/character/perks'
import type { Character } from '../../../domain/skills/character'
import { createCharacter } from '../../../domain/skills/character'
import { resolveEffectiveCharacter } from '../../../domain/skills/condition'
import { attributeVitals } from '../../../domain/skills/vitals'
import type { GameServices } from '../../contracts/game'
import type { SaveGame } from '../../contracts/save'
import type { VitalConfig } from '../../contracts/status'
import { drainStatusWithTime } from '../../services/character/drainStatusWithTime'
import { PerksService } from '../../services/character/PerksService'
import { StatusService } from '../../services/character/StatusService'
import { InventoryService } from '../../services/inventory/InventoryService'
import { DayTimeService } from '../../services/world/DayTimeService'
import { RestService } from '../../services/world/RestService'
import { createSessionDialogue } from './createSessionDialogue'

/** Bootstrap-only readers and setters for class selection state. */
interface ClassSelectionSetup {
  getCharacter: () => Character | null
  setCharacter: (value: Character) => void
  setDifficulty: (value: ReturnType<typeof difficultyRules>) => void
  getTracking: () => boolean
  setTracking: (value: boolean) => void
  difficultyId: string
  saved?: SaveGame
  rest: RestService
  daytime: DayTimeService
  status: StatusService
  inventory: InventoryService
  perks: PerksService
  dialogue: ReturnType<typeof createSessionDialogue>
  sleepState: NonNullable<Parameters<typeof drainStatusWithTime>[4]>
  definitions: Parameters<typeof resolveEffectiveCharacter>[2]
}

/**
 * Create the one-time class/difficulty selection action and initialize starting vitals.
 * @param {ClassSelectionSetup} setup - Character state and explicit gameplay capabilities.
 * @returns {GameServices['chooseClass']} Selection action; repeated selections are ignored.
 */
export function createClassSelection({
  getCharacter, setCharacter, setDifficulty, getTracking, setTracking,
  difficultyId, saved, rest, daytime, status, inventory, perks, dialogue,
  sleepState, definitions,
}: ClassSelectionSetup): GameServices['chooseClass'] {
  return (id, selectedDifficulty = difficultyId): void => {
    if (getCharacter()) return

    const definition = CLASSES.find(entry => entry.id === id)
    if (!definition) throw new Error(`Unknown class: ${id}`)

    const difficulty = difficultyRules(selectedDifficulty)
    setDifficulty(difficulty)
    rest.configure(difficulty.recovery)
    drainStatusWithTime(
      daytime,
      status,
      difficulty.timeCosts,
      () => rest.isAdvancingTime,
      sleepState
    )
    const character = createCharacter(definition)
    setCharacter(character)
    const wasTracking = getTracking()
    setTracking(false)
    try {
      inventory.grantItems(definition.startingItems.map(itemId => ({ itemId, quantity: definition.startingItemQuantities?.[itemId] ?? 1 })))
    } finally {
      setTracking(wasTracking)
    }
    const equipped = resolveEffectiveCharacter(
      character,
      inventory.getBonusItems(),
      definitions,
      status.getSnapshot(),
      status.getLimits(),
      perks.getSnapshot(),
      perks.buffDefinitions,
      perks.definitions,
      false
    )
    status.configure(
      buffVitals(
        attributeVitals(difficulty.stats as VitalConfig[], equipped.attributes),
        perks.getSnapshot(),
        perks.buffDefinitions
      ),
      difficulty.modifiers.itemRecovery
    )
    if (!saved) dialogue.openInvestigation(DIALOGUES.awakening)
  }
}
