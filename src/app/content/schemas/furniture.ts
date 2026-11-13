import { array,choice,number,object,optional,record,text } from '../schema.ts'
import { placementFields,positive,spriteFields,surface } from './common.ts'
export const furnitureSchema = object({
    types: record(object({ ...spriteFields, name: text, action: choice('rest', 'sleep', 'hide', 'none'), displayHeight: positive,
      scale: positive, interactionRadius: positive, prompt: text, revealPrompt: optional(text), platform: optional(surface), platforms: optional(array(surface)), groundOrigin: optional(number(0, false, 1)), depth: optional(number()) })),
    placements: array(object(placementFields)),
  })
