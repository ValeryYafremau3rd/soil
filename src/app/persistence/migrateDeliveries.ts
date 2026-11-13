import { deliveryItemId } from '../../domain/inventory/items.ts'
import { DAY_PHASES } from '../contracts/daytime.ts'
import type { SaveGame } from '../contracts/save'
import { courierRoutes,smugglerRoutes } from './legacyDeliveryRoutes.ts'
import type { SaveReferences } from './saveReferences.ts'

export function migrateDeliveries(save: SaveGame, references: SaveReferences): void {
if (save.inventory.deliveryVersion !== 2) {
    const tick = (save.daytime.day - 1) * 4 + DAY_PHASES.indexOf(save.daytime.phase)
    
    
    const convert = (id: string): { id: string; parameters?: import('../../domain/quests/quests').QuestParameters } => {
      if (courierRoutes[id]) return { id: 'courier-delivery', parameters: courierRoutes[id] }
      if (smugglerRoutes[id]) return { id: 'smuggler-delivery', parameters: smugglerRoutes[id] }
      if (id.startsWith('night-courier-')) return { id: 'courier-delivery', parameters: { sourceId: 'cashier', destinationId: id.slice('night-courier-'.length) } }
      if (id.startsWith('find-') && id !== 'find-item') {
        const itemId = id.slice(5), npc = itemId === 'rope' ? 'bartender' : itemId === 'service-pistol' ? 'worker' : 'citizen-mechanic'
        return { id: 'find-item', parameters: { sourceId: npc, destinationId: npc, itemId } }
      }
      return { id }
    }
    const entries = new Map<string, import('../../domain/quests/quests').QuestProgress>()
    const activeKinds = new Set<string>()
    for (const entry of save.quests.filter(entry => !entry.questId.startsWith('dusan-apartment-'))) {
      const converted = convert(entry.questId), definition = references.quests.find(quest => quest.id === converted.id)
      let current = { ...entry, questId: converted.id, ...(converted.parameters ? { parameters: converted.parameters } : {}) }
      if (entry.questId.startsWith('dusan-crate-') && !save.inventory.deliveryVersion && entry.stageIndex >= 2 && definition) current.stageIndex = definition.stages.length
      if (entry.questId.startsWith('find-') && entry.questId !== 'find-item') current.stageIndex = entry.stageIndex ? 2 : 1
      if (entry.questId.startsWith('night-courier-')) current = { ...current, stageIndex: 0, failed: true, deadline: tick }
      const active = definition && !current.failed && current.stageIndex < definition.stages.length
      if (active && definition.deliveryKind) {
        if (activeKinds.has(definition.deliveryKind)) current = { ...current, failed: true, deadline: tick }
        else activeKinds.add(definition.deliveryKind)
      }
      const previous = entries.get(current.questId)
      if (!previous || active && (!definition || previous.failed || previous.stageIndex >= definition.stages.length)) entries.set(current.questId, current)
    }
    save.quests = [...entries.values()]
    const activeParcels = new Set(save.quests.flatMap(entry => {
      const definition = references.quests.find(quest => quest.id === entry.questId)
      return definition?.deliveryItemId && !entry.failed && entry.stageIndex < definition.stages.length ? [definition.deliveryItemId] : []
    }))
    const seen = new Set<string>()
    const migrateItems = (items: SaveGame['inventory']['items']) => items.flatMap(item => {
      const id = deliveryItemId(item.itemId)
      if (id === 'courier-parcel' || id === 'smuggler-parcel') {
        if (!activeParcels.has(id) || seen.has(id)) return []
        seen.add(id)
        return [{ itemId: id, quantity: 1 }]
      }
      return [item]
    })
    save.inventory.items = migrateItems(save.inventory.items)
    for (const container of Object.values(save.inventory.containers)) container.items = migrateItems(container.items)
    save.inventory.deposits = Object.fromEntries(Object.entries(save.inventory.deposits).map(([id, items]) => {
      const quantities = new Map<string, number>()
      for (const item of items) {
        const itemId = deliveryItemId(item.itemId)
        const available = save.inventory.containers[id]?.items.filter(stack => stack.itemId === itemId).reduce((sum, stack) => sum + stack.quantity, 0) ?? 0
        const quantity = Math.min((quantities.get(itemId) ?? 0) + item.quantity, available)
        if (quantity) quantities.set(itemId, quantity)
      }
      return [id, [...quantities].map(([itemId, quantity]) => ({ itemId, quantity }))]
    }))
    if (save.notes) save.notes = { ...save.notes, items: [...new Set(save.notes.items.map(deliveryItemId))] }
    for (const key of ['courierBoard', 'npcJobs'] as const) {
      const board = save[key]
      if (!board) continue
      const parameters = { ...board.parameters }
      const offeredQuestIds = [...new Set(board.offeredQuestIds.filter(id => !id.startsWith('dusan-apartment-')).map(id => {
        const converted = convert(id)
        if (converted.parameters) parameters[converted.id] ??= converted.parameters
        return converted.id
      }))].filter(id => references.quests.some(quest => quest.id === id))
      const acceptedQuestIds = [...new Set(board.acceptedQuestIds.map(id => convert(id).id))].filter(id => offeredQuestIds.includes(id))
      for (const id of offeredQuestIds) {
        const active = save.quests.find(entry => entry.questId === id && !entry.failed)
        if (active?.parameters) parameters[id] = active.parameters
      }
      save[key] = { ...board, offeredQuestIds, acceptedQuestIds, parameters: Object.fromEntries(offeredQuestIds.filter(id => parameters[id]).map(id => [id, parameters[id]])) }
    }
    save.inventory.deliveryVersion = 2
  }
}
