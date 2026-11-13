import type {
InventoryController
} from "../../app/contracts/inventory";
import type { ItemDefinition } from '../../content/types';
import { UI_CONFIG } from "../../content/ui";
import { VITAL_LABELS } from "../../domain/inventory/items";
import { ATTRIBUTE_LABELS } from "../../domain/skills/character";
import { itemBuffMultiplier,legendarySkill,scaleItemBuff } from '../../domain/skills/effects';
import "./inventory.css";
export function ItemTimedEffects({definition,inventory}: {definition:ItemDefinition;inventory:InventoryController}) {
const skills=inventory.getSkills(),multiplier=itemBuffMultiplier(skills)
return <>      {definition.damageMultiplier !== undefined && <p className="inventory-details__effect">Weapon damage: ×{definition.damageMultiplier.toFixed(1)}</p>}
      {UI_CONFIG.consumableBuffs
        .filter((buff) => buff.itemIds.includes(definition.id) && !(buff.amount < 0 && legendarySkill(skills, 'medicine') && (['Medical','Drink','Food'].includes(definition.category) || definition.id.endsWith('-cigarettes'))))
        .map((buff) => (
          <p className="inventory-details__effect" key={buff.id}>
            On use: {buff.amount > 0 ? "+" : ""}{scaleItemBuff(buff.amount, multiplier)}{" "}
            {buff.attribute
              ? ATTRIBUTE_LABELS[buff.attribute]
              : buff.damageResistance ? "% damage resistance" : buff.fearResistance ? "% fear resistance" : `maximum ${VITAL_LABELS[buff.vital!]}`}{" "}
            for {buff.durationDays} day(s). Reuse refreshes duration; does not
            stack. Sleep removes this effect.
          </p>
        ))}
</>
}
