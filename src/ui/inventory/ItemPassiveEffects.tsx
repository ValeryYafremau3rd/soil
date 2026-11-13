import type { InventoryItemDefinition } from '../../domain/inventory/items';
import { scaleItemBuff } from '../../domain/skills/effects';
import { ItemBonusText } from './ItemBonusText';

export function ItemPassiveEffects({ item, multiplier, className }: {
  item: InventoryItemDefinition; multiplier: number; className?: string
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
