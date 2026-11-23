import type { InventoryItemDefinition, ItemSkills } from '../../../domain/inventory/items'
import {
  itemRequirementStates, understandsItem, unmetItemRequirements,
} from '../../../domain/inventory/items.ts'
import { SKILL_LABELS } from '../../../domain/skills/character.ts'

/** Live skill readers and authored definitions used to check item eligibility. */
interface RequirementAccess {
  definitions: Readonly<Record<string, InventoryItemDefinition>>
  skills(): ItemSkills
  erudition(): number
  notify(text: string): void
}

/** Checks current character eligibility without owning inventory state. */
export class InventoryRequirementChecks {
  private readonly access: RequirementAccess

  /**
   * Bind checks to live skills rather than caching eligibility across equipment changes.
   * @param {RequirementAccess} access - Definitions, skill readers and feedback callback.
   */
  constructor(access: RequirementAccess) {
    this.access = access
  }

  /**
   * Test eligibility without displaying an error message.
   * @param {string} id - Item identifier to inspect.
   * @returns {boolean} Whether the item exists and all applicable checks pass.
   */
  meetsItemRequirements = (id: string): boolean => {
    const definition = this.access.definitions[id]
    return !!definition && this.meetsRequirement(definition, false)
  }

  /**
   * Apply the domain understanding rule using live education and skills.
   * @param {string} id - Item identifier to inspect.
   * @returns {boolean} Whether the item exists and is understood.
   */
  understandsItem = (id: string): boolean => {
    const definition = this.access.definitions[id]
    return !!definition && understandsItem(
      definition, this.access.erudition(), this.access.skills(),
    )
  }

  /**
   * Resolve each requirement for inventory presentation.
   * @param {string} id - Item identifier to inspect.
   * @returns {ReturnType<typeof itemRequirementStates>} Requirement states, or an empty list.
   */
  getItemRequirementStates = (id: string): ReturnType<typeof itemRequirementStates> => {
    const definition = this.access.definitions[id]
    return definition ? itemRequirementStates(definition, this.currentSkills()) : []
  }

  /**
   * Resolve the unmet requirements shown by callers.
   * @param {string} id - Item identifier to inspect.
   * @returns {ReturnType<typeof unmetItemRequirements>} Missing requirements, or an empty list.
   */
  getUnmetItemRequirements = (id: string): ReturnType<typeof unmetItemRequirements> => {
    const definition = this.access.definitions[id]
    return definition ? unmetItemRequirements(definition, this.currentSkills()) : []
  }

  /**
   * Test eligibility and report the first blocking rule through inventory feedback.
   * @param {string} itemId - Item identifier to use.
   * @returns {boolean} Whether the item exists and may be used.
   */
  canUseItem = (itemId: string): boolean => {
    const definition = this.access.definitions[itemId]
    return !!definition && this.meetsRequirement(definition)
  }

  /**
   * Enforce understanding before checking remaining requirements, preserving feedback order.
   * @param {InventoryItemDefinition} definition - Authored item requirements.
   * @param {boolean} notify - Whether failed checks should display feedback; defaults to true.
   * @returns {boolean} Whether all applicable requirements pass.
   */
  meetsRequirement(definition: InventoryItemDefinition, notify = true): boolean {
    if (!understandsItem(definition, this.access.erudition(), this.access.skills())) {
      if (notify) this.access.notify(`Requires Erudition ${definition.eruditionRequired}`)
      return false
    }

    const missing = unmetItemRequirements(definition, this.currentSkills())
    if (!missing.length) return true

    if (notify) this.access.notify(missing.map(({ skill, required, current }) =>
      `Requires ${SKILL_LABELS[skill]} ${required}. Your ${SKILL_LABELS[skill]} is ${current}.`,
    ).join(' '))
    return false
  }

  /**
   * Overlay the dedicated education reader on the current skill snapshot.
   * @returns {ItemSkills} Skills used by requirement display and missing-rule checks.
   */
  private currentSkills(): ItemSkills {
    return { ...this.access.skills(), erudition: this.access.erudition() }
  }
}
