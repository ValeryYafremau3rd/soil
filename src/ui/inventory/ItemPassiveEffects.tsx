import type { InventoryItemDefinition } from '../../domain/inventory/items'
import { scaleItemBuff } from '../../domain/skills/effects'
import { ItemBonusText } from './ItemBonusText'

/**
 * Perform item passive effects.
 * @param {{ item: InventoryItemDefinition multiplier: number className?: string }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function ItemPassiveEffects({ item, multiplier, className }: {
  item: InventoryItemDefinition
  multiplier: number
  className?: string
}) {
  return <>
    {(item.bonus || item.bonuses?.length) && <p className={className}>
      <ItemBonusText item={item} multiplier={multiplier} />
    </p>}
    {!!item.stealthModifier && <p className={className}>
      {item.stealthModifier > 0 ? '+' : ''}{scaleItemBuff(item.stealthModifier, multiplier)} Stealth
    </p>}
    {!!item.damageResistance && <p className={className}>+{scaleItemBuff(item.damageResistance, multiplier)}% Damage resistance</p>}
    {!!item.fearResistance && <p className={className}>+{scaleItemBuff(item.fearResistance, multiplier)}% Fear resistance</p>}
  </>
}
