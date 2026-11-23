import { ADVICE_RARITIES } from '../../../domain/dialogue/dialogue.ts'
import { array, choice, number, object, text } from '../schema.ts'
export const adviceSchema = object({
  entries: array(
    object({ id: text, rarity: choice(...ADVICE_RARITIES), level: number(1, true, 20), text }),
    true
  )
})
