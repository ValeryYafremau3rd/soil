import { array, choice, number, object, optional, record, text } from '../schema.ts'

/** Narrative slides select one authored variant using supported final-state conditions. */
export const endingSlidesSchema = object({
  images: array(text, true),
  fadeMs: number(0),
  nextLabel: text,
  backLabel: text,
  finishLabel: text,
  slides: array(object({
    id: text,
    title: text,
    defaultVariant: text,
    variants: record(text),
    rules: array(object({
      variant: text,
      when: object({
        route: optional(choice('illegal', 'official')),
        absentNpcId: optional(text),
        decision: optional(object({ id: text, value: text })),
      }),
    })),
  }), true),
})
