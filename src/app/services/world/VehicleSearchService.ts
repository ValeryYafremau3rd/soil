import type { DialogueController } from '../../contracts/dialogue'
import type { InventoryController } from '../../contracts/inventory'
import type { QuestController } from '../../contracts/quests'
import type { DialogueDefinition } from '../../../domain/dialogue/dialogue'
import config from '../../../content/skills.json' with { type: 'json' }

const questId = 'factory-supplies'
const rules = config.vehicleSearch

/** Inventory owns daily contents and persistence; an investigation owns only its open lock. */
export class VehicleSearchService {
  private readonly dialogue: DialogueController
  private readonly inventory: Pick<InventoryController, 'openContainer'>
  private readonly quests: Pick<QuestController, 'canAdvanceDialogue' | 'advanceDialogue'>
  private readonly skill: (id: string) => number
  private readonly night: () => boolean

  /**
   * Initialize the VehicleSearchService instance and its collaborators.
   * @param {DialogueController} dialogue - The dialogue supplied to this operation.
   * @param {Pick<InventoryController, "openContainer">} inventory - Inventory capability used to read or transact items.
   * @param {Pick<QuestController, "canAdvanceDialogue" | "advanceDialogue">} quests - The quests supplied to this operation.
   * @param {(id: string) => number} skill - The skill supplied to this operation.
   * @param {() => boolean} night - The night supplied to this operation.
   * @returns {VehicleSearchService} The initialized instance.
   */
  constructor(
    dialogue: DialogueController,
    inventory: Pick<InventoryController, 'openContainer'>,
    quests: Pick<QuestController, 'canAdvanceDialogue' | 'advanceDialogue'>,
    skill: (id: string) => number,
    night: () => boolean
  ) {
    this.dialogue = dialogue
    this.inventory = inventory
    this.quests = quests
    this.skill = skill
    this.night = night
  }

  /**
   * Perform open for VehicleSearchService.
   * @param {string} vehicleId - The vehicle id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  open = (vehicleId: string): void => {
    let unlocked = false

    /**
     * Perform approach.
     * @returns {boolean} Whether the requested condition is satisfied.
     */
    const approach = () => this.night() || this.skill('stealth') >= rules.stealth

    /**
     * Check whether choose is allowed.
     * @param {string} id - The id supplied to this operation.
     * @returns {boolean} Whether the requested condition is satisfied.
     */
    const canChoose = (id: string): boolean => {
      if (id === 'leave') return true

      if (!approach()) return false

      if (id === 'crates') return vehicleId === 'factory-big-car'
        && this.quests.canAdvanceDialogue(questId, 'worker', 'supplies-crates')

      if (id === 'pick') return this.skill('lockpicking') >= rules.lockpicking

      if (id === 'break') return this.skill('athletics') >= rules.athletics

      if (id === 'parts') return unlocked && this.skill('scraper') >= rules.scraper

      if (id === 'valuables') return unlocked && this.skill('barter') >= rules.barter

      return id === 'approach'
    }
    const leave = { id: 'leave', text: 'Leave.', close: true }
    const definition: DialogueDefinition = {
      start: 'start',
      nodes: {
        start: {
          text: `A parked vehicle. Approach at night or with Stealth ${rules.stealth}.`,
          choices: [
            { id: 'approach', text: 'Approach the vehicle.', next: 'outside' }, leave,
          ]
        },
        outside: {
          text: 'The cargo crates can be inspected separately from the locked vehicle.',
          choices: [
            { id: 'crates', text: '[Quest] Inspect the supply crates.', next: 'empty' },
            { id: 'pick', text: `[Lockpicking ${rules.lockpicking}] Pick the lock.`, next: 'inside' },
            { id: 'break', text: `[Athletics ${rules.athletics}] Break the lock.`, next: 'inside' },
            leave,
          ]
        },
        empty: {
          text: 'The factory supply crates are empty. Kovalenko needs to hear about this.',
          choices: [leave]
        },
        inside: {
          text: 'The lock is open. Search for useful parts or valuables. Contents refresh each morning.',
          choices: [
            { id: 'parts', text: `[Scraper ${rules.scraper}] Find valuable parts.`, close: true },
            { id: 'valuables', text: `[Barter ${rules.barter}] Find valuable items.`, close: true },
            leave,
          ]
        },
      }
    }
    this.dialogue.openInvestigation(
      definition,
      {
        canChoose,
        choose: id => {
          if (!canChoose(id)) return false

          if (id === 'crates') return this.quests.advanceDialogue(questId, 'worker', 'supplies-crates')

          if (id === 'pick' || id === 'break') unlocked = true

          if (id === 'parts' || id === 'valuables') this.inventory.openContainer(`${vehicleId}:${id}`)

          return true
        }
      }
    )
  }
}
