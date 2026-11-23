import { UI_CONFIG } from '../../content/ui.ts'
import { normalizeConsumableGroups } from '../../domain/character/perks.ts'
import { DAY_PHASES } from '../contracts/daytime.ts'
import type { SaveGame } from '../contracts/save'
import { checkSave as check } from './checkSave.ts'
import type { SaveReferences } from './saveReferences.ts'

/**
 * Validate saved identity against the supported rules.
 * @param {SaveGame} save - The save supplied to this operation.
 * @param {SaveReferences} references - The references supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function validateSavedIdentity(
  save: SaveGame,
  references: SaveReferences
): void {
  check(references.classIds.includes(save.classId) && references.difficultyIds.includes(save.difficultyId))
  check(Number.isFinite(Date.parse(save.savedAt)))

  for (const [id, day] of Object.entries(save.intimidatedDays ?? {})) {
    check(references.npcIds.includes(id) && day <= save.daytime.day)
  }

  for (const [id, day] of Object.entries(save.adviceDays ?? {})) {
    check(references.npcIds.includes(id) && day <= save.daytime.day)
  }

  if (save.perks) {
    save.perks = normalizeConsumableGroups(save.perks, UI_CONFIG.consumableBuffs)
    const state = save.perks
    const tick = (save.daytime.day - 1) * DAY_PHASES.length + DAY_PHASES.indexOf(save.daytime.phase)
    check(new Set(state.acquired).size === state.acquired.length)
    check(new Set((state.buffs ?? []).map(buff => buff.id)).size === (state.buffs ?? []).length)
    const buffGroups = new Map<string, string[]>()

    for (const buff of state.buffs ?? []) {
      const definition = UI_CONFIG.consumableBuffs.find(entry => entry.id === buff.id)
      check(definition && buff.expiresAt <= tick + definition.durationDays * DAY_PHASES.length)
      if (definition && 'group' in definition && definition.group) {
        const candidates = (buffGroups.get(definition.group) ?? definition.itemIds).filter(id => definition.itemIds.includes(id))
        check(candidates.length > 0)
        buffGroups.set(definition.group, candidates)
      }
    }

    const groups = new Set<string>()

    for (const id of new Set([...Object.keys(state.counts), ...Object.keys(state.habits), ...state.acquired])) {
      const perk = UI_CONFIG.perks.find(perk => perk.id === id)
      check(perk)
      check((state.counts[id] ?? 0) <= perk!.goal)
      const habit = state.habits[id]
      if (perk!.actionPoints) check(!habit)
      else check(habit && habit.lastUse <= habit.lastPenalty && habit.lastPenalty <= tick)

      if (state.acquired.includes(id)) {
        check(state.counts[id] === perk!.goal && !groups.has(perk!.group))
        check(perk!.actionPoints || habit.willpower === undefined || habit.willpower === perk!.willpowerOnUse || habit.willpower === 2 || habit.willpower === perk!.willpowerAfterDay)
        groups.add(perk!.group)
      }
    }
  }

  if (save.notes) {
    const known = {
      locations: references.locations.map(location => location.id),
      people: references.npcIds,
      items: references.items.map(item => item.id)
    }

    for (const category of ['locations', 'people', 'items'] as const) {
      check(new Set(save.notes[category]).size === save.notes[category].length)

      for (const id of save.notes[category]) check(known[category].includes(id))
    }
  }
}
