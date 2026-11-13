import type { DialogueController } from './dialogue'
import type { InventoryController } from './inventory'
import type { TravelController } from './travel'
import type { HudController } from './hud'
import type { DayTimeController } from './daytime'
import type { RestController } from './rest'
import type { Character } from '../../domain/skills/character'
import type { StatusController } from './status'
import type { DifficultyRules } from '../../domain/character/difficulty'
import type { SkillEffects } from '../../domain/skills/effects'

import type { LockpickingController } from './lockpicking'
import type { QuestController } from './quests'
import type { MessageController } from './messages'
import type { OptionsController } from './save'
import type { LoadingController } from './loading'
import type { NotesController } from './notes'

export interface GameServices {
  statistics: import('./statistics').StatisticsController
  perks: import('./perks').PerksController
  notes: NotesController
  loading: LoadingController
  options: OptionsController
  messages: MessageController
  quests: QuestController
  lockpicking: LockpickingController
  readonly skillEffects: SkillEffects
  readonly character: Character | null
  readonly difficulty: DifficultyRules
  status: StatusController
  chooseClass(classId: string, difficultyId?: string): void
  rest: RestController
  daytime: DayTimeController
  travel: TravelController
  dialogue: DialogueController
  inventory: InventoryController
  hud: HudController
}
