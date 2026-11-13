import { object,record } from '../schema.ts'
import { npcFields } from './common.ts'
export const npcsSchema = record(object(npcFields))
