import { ITEM_RARITIES } from '../../../domain/inventory/items.ts'
import { DAY_PHASES } from '../../contracts/daytime.ts'
import { array, boolean, choice, number, object, optional, text } from '../schema.ts'
import { integer, stack } from './common.ts'
export const questsSchema = array(object({
  deliveryKind: optional(choice('courier', 'smuggler')),
  deliveryItemId: optional(text),
  destinations: optional(array(object({ id: text, name: text, containerId: optional(text) }), true)),
  morningStart: optional(boolean),
  autoStart: optional(boolean),
  id: text,
  name: text,
  description: text,
  retryStage: optional(integer),
  repeatable: optional(boolean),
  findItem: optional(text),
  findItemOptions: optional(array(
    object({ id: text, name: text, price: number(1), rarity: choice(...ITEM_RARITIES) }),
    true
  )),
  prerequisites: optional(array(text, true)),
  offeredBy: optional(text),
  offerText: optional(text),
  retryTrigger: optional(object({ npcId: text, choiceId: text })),
  reward: optional(object({ items: optional(array(stack, true)), money: optional(integer) })),
  stages: array(
    object({
      id: text,
      worldInteraction: optional(text),
      collectedFrom: optional(text),
      description: text,
      parallelGroup: optional(text),
      phases: optional(array(choice(...DAY_PHASES), true)),
      deadlinePhases: optional(number(1, true)),
      trigger: {
        kind: 'union',
        items: [
          object({
            kind: choice('action'),
            action: choice('buy', 'consume', 'bus', 'rest', 'sleep',
              'workAsked', 'gunDefeat', 'meleeDefeat', 'chaseHidden', 'objectHidden'),
            itemIds: optional(array(text, true))
          }),
          object({ kind: choice('location'), locationId: text }),
          object({ kind: choice('room'), locationId: text, buildingId: text, roomId: text }),
          object({ kind: choice('questAccepted'), npcId: text }),
          object({ kind: choice('dialogue'), npcId: text, choiceId: text }),
          object({ kind: choice('inventory') }),
          object({ kind: choice('accept') }),
          object({ kind: choice('pending') }),
          object({ kind: choice('loot'), containerId: text }),
          object({ kind: choice('deposit'), containerId: text })
        ]
      },
      requiredItemGroups: optional(array(array(text, true), true)),
      removeRequiredItemGroups: optional(boolean),
      requiredItems: optional(array(stack, true)),
      removeItems: optional(array(stack, true)),
      grantItems: optional(array(stack, true)),
    }),
    true
  )
}))
