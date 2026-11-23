import { array, number, object, record, text } from '../schema.ts'

const mix = object({ track: text, outside: number(0, false, 1), inside: number(0, false, 1) })
export const audioSchema = object({
  running: text,
  masterVolume: number(0, false, 1),
  tracks: record(object({ path: text, volume: number(0, false, 1) })),
  events: record(text),
  music: object({ loading: text, ending: text, daytime: array(text, true), night: array(text) }),
  pursuit: object({ human: text, monster: text }),
  spotted: record(text),
  locations: record(array(mix)),
  nightAmbient: array(mix),
})
