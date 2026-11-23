import { DIFFICULTY_MODIFIERS } from '../../../domain/character/difficulty.ts'
import { array, number, object, text } from '../schema.ts'
import { positive } from './common.ts'
export const difficultySchema = object({
  defaultId: text,
  presets: array(
    object({
      id: text,
      name: text,
      description: text,
      modifiers: object(Object.fromEntries(DIFFICULTY_MODIFIERS.map(key => [
        key,
        ['maximumStats', 'patrolHealth', 'patrolCooldown', 'monsterStrength'].includes(key) ? positive : number(0),
      ]))),
    }),
    true
  )
})
