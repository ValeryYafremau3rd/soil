import { CONTENT } from './catalogue'
import type { RoomDefinition } from './types'

export const ROOMS = CONTENT.data.rooms as Readonly<Record<string, RoomDefinition>>
