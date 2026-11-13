import { requireCondition,unique } from './assertions.ts'
import type { ContentContext } from './context.ts'
import { validateNpc } from './validateNpc.ts'

export function validateActors(context: ContentContext) {
  const { npcs, patrols, items } = context
for (const [id, npc] of Object.entries(npcs)) validateNpc(context)(npc, `npcs.json.${id}`)
for (const [id, patrol] of Object.entries(patrols.types)) {
    const path = `patrols.json.types.${id}`
    validateNpc(context)(patrol, path)
    unique((patrol.corpseLoot ?? []).map(drop => drop.itemId), `${path}.corpseLoot`)
    for (const drop of patrol.corpseLoot ?? []) {
      requireCondition(items.some(item => item.id === drop.itemId), `${path}.corpseLoot: unknown item ${drop.itemId}`)
      requireCondition(drop.min <= drop.max, `${path}.corpseLoot.${drop.itemId}: min must not exceed max`)
    }
    requireCondition(Boolean(patrol.shoot) === Boolean(patrol.combat.ranged), `${path}: shoot animation and ranged settings must be supplied together`)
    if (patrol.combat.ranged) {
      requireCondition(patrol.shoot!.key !== patrol.attack.key, `${path}.shoot.key: must differ from the melee animation`)
      requireCondition(patrol.kind !== 'monster', `${path}.combat.ranged: only officers carry firearms`)
      requireCondition(patrol.combat.ranged.range > patrol.combat.meleeRange, `${path}.combat.ranged.range: must exceed meleeRange`)
      requireCondition(patrol.combat.ranged.heightTolerance >= patrol.combat.levelTolerance,
        `${path}.combat.ranged.heightTolerance: must cover the melee level tolerance`)
    }
    requireCondition(patrol.kind !== 'monster' || patrol.combat.fear, `${path}.combat.fear: monsters require a fear aura`)
    if (patrol.combat.fear) {
      requireCondition(patrol.kind === 'monster', `${path}.combat.fear: only monsters have fear auras`)
      requireCondition(patrol.combat.fear.radius > patrol.combat.detectionRadius,
        `${path}.combat.fear.radius: must exceed detectionRadius`)
    }
    requireCondition(patrol.movement.minWalkMs <= patrol.movement.maxWalkMs
      && patrol.movement.minPauseMs <= patrol.movement.maxPauseMs, `${path}.movement: minimum durations must not exceed maximum durations`)
  }
}
