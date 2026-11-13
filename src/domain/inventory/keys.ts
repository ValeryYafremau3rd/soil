import type { InventoryItemDefinition } from './items'
import type { ContainerContents,ItemStack } from './loot'

export function attachKeyItems(items: readonly ItemStack[], keyItems: readonly string[], containers: Readonly<Record<string, Pick<ContainerContents,'items'>>>, definitions: Readonly<Record<string,InventoryItemDefinition>>) {
    const attached = items.filter(item => definitions[item.itemId]?.attachToKeyRing)
    const remaining = items.filter(item => !definitions[item.itemId]?.attachToKeyRing)
    if (attached.length && ![...remaining, ...Object.values(containers).flatMap(container => container.items)]
      .some(item => item.itemId === 'key-ring')) remaining.push({ itemId: 'key-ring', quantity: 1 })
    return { items: attached.length ? remaining : items,
      keyItems: [...new Set([...keyItems, ...attached.map(item => item.itemId)])] }
  }
