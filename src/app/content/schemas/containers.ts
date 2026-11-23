import { ITEM_RARITIES } from '../../../domain/inventory/items.ts'
import { array, boolean, choice, number, object, optional, record, text } from '../schema.ts'
import { integer, placementFields, positive, quality, stack, surface } from './common.ts'
const sheet = object({
  sourceKey: text,
  textureKey: text,
  path: text,
  referenceWidth: positive,
  background: optional(choice('none', 'light', 'dark'))
})
export const containersSchema = object({
  rarityWeights: object(Object.fromEntries(ITEM_RARITIES.map(rarity => [rarity, positive]))),
  sheet,
  types: record(object({
    sheet: optional(sheet),
    name: text,
    quality,
    x: number(),
    y: number(),
    width: positive,
    height: positive,
    displayHeight: positive,
    scale: optional(positive),
    groundOrigin: optional(number(0, false, 1)),
    platform: optional(surface),
    locked: optional(boolean)
  })),
  interaction: object({ radius: positive, prompt: text }),
  lootTables: record(object({
    minItems: integer,
    maxItems: integer,
    itemIds: { kind: 'union', items: [choice('all'), array(text)] },
    rarityWeighted: optional(boolean),
    weights: optional(record(positive))
  })),
  placements: array(object({
    ...placementFields,
    roomId: optional(text),
    heightOffset: optional(number(0)),
    items: optional(array(stack)),
    lootTable: optional(text),
    locked: optional(boolean),
    keyOnly: optional(boolean),
    quality: optional(quality),
    questId: optional(text),
    questIds: optional(array(text, true)),
    developerStock: optional(boolean),
    restock: optional(boolean),
    nightOnly: optional(boolean),
    lockRarity: optional(choice(...ITEM_RARITIES))
  })),
})
