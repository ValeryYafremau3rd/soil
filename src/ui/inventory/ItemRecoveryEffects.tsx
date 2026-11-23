import type {
  InventoryController
} from "../../app/contracts/inventory"
import type {
  StatusController,
  StatusSnapshot,
} from "../../app/contracts/status"
import type { ItemDefinition } from '../../content/types'
import { UI_CONFIG } from "../../content/ui"
import type { Vital } from "../../domain/inventory/items"
import { VITAL_LABELS } from "../../domain/inventory/items"
import { legendarySkill } from '../../domain/skills/effects'
import "./inventory.css"

/**
 * Perform item recovery effects.
 * @param {object} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function ItemRecoveryEffects({ definition, inventory, status, vitals, canConsume }: { definition: ItemDefinition; inventory: InventoryController; status: StatusController; vitals: StatusSnapshot; canConsume: boolean }) {
  const skills = inventory.getSkills()
  const recovery = Object.entries(
    status.getRecovery(
      status.getItemRecovery(definition.recovery ?? {}, definition.id),
    ),
  ) as [Vital, number][]
  const canRecover = recovery.some(
    ([key, amount]) => amount > 0 && vitals[key] < status.getLimits()[key],
  )

  return <>
      {canConsume && definition.readable && !inventory.getSnapshot().readBooks.includes(definition.id) && (
      <p className="inventory-help">Enter: Read and consume one.</p>
    )}
      {recovery.length > 0 && (
      <p className="inventory-details__effect">
          On use:{" "}
          {recovery
          .map(([key, amount]) => `+${amount} ${VITAL_LABELS[key]}`)
          .join(", ")}
        </p>
    )}
      {canConsume && definition.consumable && (recovery.length > 0 || UI_CONFIG.consumableBuffs.some(buff => buff.itemIds.includes(definition.id))) && (
      <p className="inventory-help">
          {canRecover
          ? "Enter: Consume one."
          : status.canConsumeAtMaximum?.(definition.id)
            ? "Enter: Consume one (no vital recovery needed)."
            : "Recovery already at maximum."}
        </p>
    )}
      {canConsume && definition.keys?.length && (
      <p className="inventory-help">Enter: View keys.</p>
    )}
      {definition.inventorySlots && (
      <p className="inventory-details__effect">
          +{definition.inventorySlots} inventory slots while equipped
        </p>
    )}
      {definition.scrap && (
      <p className="inventory-help">
          {canConsume ? "Enter: Scrap one." : "Scrap material."}{" "}
          {legendarySkill(skills, 'scraper')
          ? `Scraper recovery chance: ${Math.round(inventory.getScrapChance() * 100)}%. Successful recovery gives a useful non-ammo item; otherwise, receive 1–3 bullets. The result must fit in inventory.`
          : `Scraper recovery chance: ${Math.round(inventory.getScrapChance() * 100)}%. Scrap is spent even when nothing is found. Possible finds include ammunition, tools, and rare weapons.`}
        </p>
    )}
  </>
}
