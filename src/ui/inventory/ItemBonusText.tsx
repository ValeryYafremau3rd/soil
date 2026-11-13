import { scaleItemBuff } from '../../domain/skills/effects'
import { ATTRIBUTE_LABELS, SKILL_LABELS } from '../../domain/skills/character'
import { itemBonuses } from '../../domain/inventory/items'
import type { InventoryItemDefinition } from '../../domain/inventory/items'

export function ItemBonusText({ item, multiplier = 1 }: { item: InventoryItemDefinition; multiplier?: number }) {
  return <>{itemBonuses(item).map((bonus, index) => <span key={index}>
    {index > 0 && ', '}+{scaleItemBuff(bonus.amount, multiplier, item.category)} {'attribute' in bonus ? ATTRIBUTE_LABELS[bonus.attribute] : SKILL_LABELS[bonus.skill]}
  </span>)}</>
}
