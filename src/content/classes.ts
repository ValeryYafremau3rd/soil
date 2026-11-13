import config from './classes.json' with { type: 'json' }
import type { ClassDefinition } from '../domain/skills/character'
import { validateClasses } from '../domain/skills/character'
import { ITEMS } from './items'

export const CLASSES: readonly ClassDefinition[] = config
validateClasses(CLASSES, ITEMS.map(item => item.id))
