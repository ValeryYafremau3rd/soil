import { array,choice,number,object,optional,record,text } from '../schema.ts'
import { placementFields,positive,spriteFields,surface } from './common.ts'
export const taskboardsSchema = object({
    types: record(object({ ...spriteFields, name: text, space: choice('inside', 'outside'), displayHeight: positive,
      scale: positive, interactionRadius: positive, prompt: text, menuId: text, platform: optional(surface) })),
    placements: array(object({ ...placementFields, heightOffset: number(0) })),
  })
