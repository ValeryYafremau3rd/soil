import type { InventoryItemDefinition } from './items'

/** Prices are per item. Round down before multiplying by the stack quantity. */
export function tradePrice(item: Pick<InventoryItemDefinition, 'price'>, selling = false,
  modifiers: { buyPrice: number; sellPrice: number } = { buyPrice: 1, sellPrice: 0.5 }, understood = true): number {
  if (selling && !understood) return 1
  const price = item.price ?? 1
  const buy = Math.max(1, Math.ceil(Number((price * modifiers.buyPrice).toFixed(8))))
  return selling ? Math.max(1, Math.min(buy, Math.floor(Number((price * modifiers.sellPrice).toFixed(8))))) : buy
}
