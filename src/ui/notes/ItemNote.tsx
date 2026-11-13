import type { InventoryController } from '../../app/contracts/inventory';
import { ITEM_BY_ID } from "../../content/items";
import { UI_CONFIG } from '../../content/ui';
import type { Vital } from "../../domain/inventory/items";
import { VITAL_LABELS } from "../../domain/inventory/items";
import { itemBuffMultiplier } from '../../domain/skills/effects';
import { ItemIcon } from "../inventory/ItemIcon";
import { ItemPassiveEffects } from '../inventory/ItemPassiveEffects';
import { ItemPrice } from '../inventory/ItemPrice';
import { ItemRequirements } from '../inventory/ItemRequirements';
import "./notes.css";
export function ItemNote({ id, inventory }: { id: string; inventory: InventoryController }) {
const item = ITEM_BY_ID[id];
const multiplier = itemBuffMultiplier(inventory.getSkills());
return (
    <>
      <ItemIcon itemId={id} size={UI_CONFIG.noteIconSize} />
      <h3>{item.name}</h3>
      <ItemRequirements requirements={inventory.getItemRequirementStates(id)} />
      <ItemPassiveEffects item={item} multiplier={multiplier} />
      {item.inventorySlots && (
        <p>
          Provides {item.inventorySlots} additional inventory slots while
          equipped.
        </p>
      )}
      {item.recovery && (
        <p>
          On use:{" "}
          {Object.entries(item.recovery)
            .map(
              ([vital, amount]) => `${VITAL_LABELS[vital as Vital]} +${amount}`,
            )
            .join(", ")}
        </p>
      )}
      {item.firearm && (
        <p>Ammunition: {ITEM_BY_ID[item.firearm.ammunitionId].name}</p>
      )}
      {item.scrap && (
        <p>
          Scrap: consume it for a chance to recover ammunition, tools, or a rare
          weapon. Scraper improves the chance.
        </p>
      )}
      <p>Maximum stack: {item.maxStack ?? 1}</p>
      <p><ItemPrice itemId={id} inventory={inventory} /></p>
    </>
  );
}
