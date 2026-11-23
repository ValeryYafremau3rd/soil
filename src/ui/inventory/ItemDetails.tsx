import type {
  InventoryController
} from "../../app/contracts/inventory"
import type {
  StatusController,
  StatusSnapshot,
} from "../../app/contracts/status"
import { ITEM_BY_ID } from "../../content/items"
import { UI_CONFIG } from "../../content/ui"
import type { ItemStack } from "../../domain/inventory/loot"
import { itemBuffMultiplier } from '../../domain/skills/effects'
import "./inventory.css"
import { ItemIcon } from "./ItemIcon"
import { ItemPassiveEffects } from './ItemPassiveEffects'
import { ItemPrice } from './ItemPrice'
import { ItemRecoveryEffects } from './ItemRecoveryEffects'
import { ItemRequirements } from './ItemRequirements'
import { ItemReadingStatus } from './ItemReadingStatus'
import { ItemTimedEffects } from './ItemTimedEffects'
import { inventoryAppearance } from './rarity'

/**
 * Perform item details.
 * @param {object} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function ItemDetails({
  item,
  canConsume,
  vitals,
  status,
  trading,
  selling,
  money,
  tradeQuantity,
  inventory,
}: {
  item?: ItemStack
  canConsume: boolean
  vitals: StatusSnapshot
  status: StatusController
  trading: boolean
  selling: boolean
  money: number
  tradeQuantity: number
  inventory: InventoryController
}) {
  if (!item)
    return (
      <aside className="inventory-details">
        <p>Select an item to inspect it.</p>
      </aside>
    )

  const definition = ITEM_BY_ID[item.itemId]
  const skills = inventory.getSkills()
  const readingStatus = definition.readable ? <ItemReadingStatus itemId={item.itemId} inventory={inventory} /> : null
  const multiplier = definition.readable ? 1 : itemBuffMultiplier(skills)
  if (!inventory.understandsItem(item.itemId))
    return (
      <aside
        className="inventory-details"
        aria-label="Item details"
        aria-live="polite"
      >
        <ItemIcon itemId={item.itemId} size={UI_CONFIG.detailIconSize} />
        <h3 className="inventory-item-name" data-appearance={inventoryAppearance(definition, false)}>{definition.name}</h3>
        {readingStatus}
        <ItemRequirements requirements={inventory.getItemRequirementStates(item.itemId)} />
        <p><ItemPrice itemId={item.itemId} inventory={inventory} selling={selling} /></p>
      </aside>
    )

  return (
    <aside
      className="inventory-details"
      aria-label="Item details"
      aria-live="polite"
    >
      <ItemIcon itemId={item.itemId} size={UI_CONFIG.detailIconSize} />
      <h3 className="inventory-item-name" data-appearance={inventoryAppearance(definition, true)}>{definition.name}</h3>
      <ItemRequirements requirements={inventory.getItemRequirementStates(item.itemId)} />
      <p className="inventory-details__category">
        {definition.category} · {definition.rarity}
      </p>
      {readingStatus}
      <ItemTimedEffects definition={definition} inventory={inventory} />
      {trading && !selling && (tradeQuantity === 0 || inventory.getPrice(item.itemId) * tradeQuantity > money) && (
        <p className="inventory-help">
          {tradeQuantity === 0 ? "Inventory full." : "Not enough Thalers."}
        </p>
      )}
      <ItemPassiveEffects item={definition} multiplier={multiplier} className="inventory-details__effect" />
      <ItemRecoveryEffects definition={definition} inventory={inventory} status={status} vitals={vitals} canConsume={canConsume} />
      <p><ItemPrice itemId={item.itemId} inventory={inventory} selling={selling} /></p>
    </aside>
  )
}
