import { audioSchema } from './schemas/audio.ts'
import { storySchema } from './schemas/story.ts'
import type { Schema } from './schema'
import { adviceSchema } from './schemas/advice.ts'
import { buildingsSchema } from './schemas/buildings.ts'
import { containersSchema } from './schemas/containers.ts'
import { daytimeSchema } from './schemas/daytime.ts'
import { dialoguesSchema } from './schemas/dialogues.ts'
import { difficultySchema } from './schemas/difficulty.ts'
import { furnitureSchema } from './schemas/furniture.ts'
import { heroSchema } from './schemas/hero.ts'
import { itemsSchema } from './schemas/items.ts'
import { locationsSchema } from './schemas/locations.ts'
import { npcsSchema } from './schemas/npcs.ts'
import { patrolsSchema } from './schemas/patrols.ts'
import { questsSchema } from './schemas/quests.ts'
import { roomsSchema } from './schemas/rooms.ts'
import { settingsSchema } from './schemas/settings.ts'
import { skillsSchema } from './schemas/skills.ts'
import { taskboardsSchema } from './schemas/taskboards.ts'
import { uiSchema } from './schemas/ui.ts'

export const CONFIG_SCHEMAS: Record<string, Schema> = {
  story: storySchema,
  audio: audioSchema,
  advice: adviceSchema,
  quests: questsSchema,
  skills: skillsSchema,
  difficulty: difficultySchema,
  patrols: patrolsSchema,
  taskboards: taskboardsSchema,
  daytime: daytimeSchema,
  buildings: buildingsSchema,
  rooms: roomsSchema,
  furniture: furnitureSchema,
  npcs: npcsSchema,
  containers: containersSchema,
  locations: locationsSchema,
  items: itemsSchema,
  dialogues: dialoguesSchema,
  hero: heroSchema,
  settings: settingsSchema,
  ui: uiSchema,
}
