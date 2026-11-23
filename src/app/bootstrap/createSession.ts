import audioConfig from '../../content/audio.json'
import { CONTENT } from '../../content/catalogue'
import { DAYTIME_CONFIG } from '../../content/daytime'
import { DIFFICULTIES, difficultyRules } from '../../content/difficulty'
import { ITEMS } from '../../content/items'
import { LOCATIONS } from '../../content/locations'
import { UI_CONFIG } from '../../content/ui'
import type { Character } from '../../domain/skills/character'
import type { SkillEffectConfig, SkillEffects } from '../../domain/skills/effects'
import { resolveSkillEffects } from '../../domain/skills/effects'
import { validateContent } from '../content/validateContent'
import type { GameServices } from '../contracts/game'
import { AudioService } from '../services/audio/AudioService'
import { StatisticsService } from '../services/progression/StatisticsService'
import { HudService } from '../services/ui/HudService'
import { DayTimeService } from '../services/world/DayTimeService'
import { VehicleSearchService } from '../services/world/VehicleSearchService'
import { createAdventureServices } from './session/createAdventureServices'
import { createEffectiveCharacterResolver } from './session/createEffectiveCharacterResolver'
import { createCharacterServices } from './session/createCharacterServices'
import { createClassSelection } from './session/createClassSelection'
import { createSessionDialogue } from './session/createSessionDialogue'
import { createSessionInventory } from './session/createSessionInventory'
import type { SessionOptions } from './session/createSessionOptions'
import { createSessionOptions } from './session/createSessionOptions'
import { observeCharacterLimits } from './session/observeCharacterLimits'
import { createSaveReferences } from './session/createSaveReferences'
import { startSessionLifecycle } from './session/startSessionLifecycle'
import { wireInventoryEvents } from './session/wireInventoryEvents'

import { validateSave } from '../persistence/validateSave'
import { NotesService } from '../services/progression/NotesService'
import { MessageService } from '../services/ui/MessageService'
import { StoryService } from '../services/progression/StoryService'
import { StoryInteractions } from '../services/progression/StoryInteractions'
import type { StoryConfig } from '../../domain/quests/story'

/**
 * One validated content catalogue and one set of stores outlive scene restarts.
 * @param {string | undefined} classId - The class id supplied to this operation.
 * @param {string} difficultyId - The difficulty id supplied to this operation.
 * @param {SessionOptions} options - Saved state, storage and application lifecycle callbacks.
 * @returns {GameServices} Typed gameplay services that persist across scene restarts.
 */
export function createSession(
  classId?: string,
  difficultyId = DIFFICULTIES.defaultId,
  options: SessionOptions = {}
): GameServices {
  validateContent(CONTENT.data, CONTENT.sources)
  const references = createSaveReferences()
  const saved = options.saved ? validateSave(options.saved, references) : undefined
  const daytime = new DayTimeService(
    saved?.daytime.day ?? DAYTIME_CONFIG.initialDay,
    saved?.daytime.phase ?? DAYTIME_CONFIG.initialPhase,
    saved?.daytime.weather
  )
  const statistics = new StatisticsService(saved?.statistics)
  const messages = new MessageService()
  let difficulty = difficultyRules(saved?.difficultyId ?? difficultyId)
  let character: Character | null = null
  const definitions = Object.fromEntries(ITEMS.map(item => [item.id, item]))
  const notes = new NotesService({
    locations: LOCATIONS.map(location => location.id),
    people: references.npcIds,
    items: ITEMS.map(item => item.id)
  })
  const currentCharacter = createEffectiveCharacterResolver({
    getCharacter: () => character,
    getInventory: () => inventory,
    getStatus: () => status,
    getPerks: () => perks,
    definitions,
  })
  /**
   * Read live skill modifiers derived from the selected character.
   * @returns {object} The result described by the TypeScript return signature.
   */
  const skillEffects = (): SkillEffects => resolveSkillEffects(
    currentCharacter()?.skills ?? {},
    CONTENT.data.skills as SkillEffectConfig
  )
  const { status, perks, loading, rest, sleepState } = createCharacterServices({
    difficulty, daytime, statistics, messages, saved, skillEffects, currentCharacter,
    getInventory: () => inventory,
    getQuests: () => quests,
    onWake: () => {
      services.audio.cue('wake')
      services.options.save()
    },
  })
  const inventory = createSessionInventory({
    daytime, status, perks, messages, skillEffects, currentCharacter,
    isNpcAbsent: id => story?.isNpcAbsent(id) ?? false,
    getQuests: () => quests,
    getLockpicking: () => lockpicking,
  })
  const tracking = wireInventoryEvents(inventory, perks, statistics)
  const { quests, travel, lockpicking } = createAdventureServices({
    inventory, messages, daytime, perks, statistics, loading, rest, currentCharacter, saved,
  })
  const dialogue = createSessionDialogue({
    inventory, quests, notes, daytime, perks, messages, currentCharacter, saved,
    getStory: () => story,
  })
  const storyConfig = CONTENT.data.story as StoryConfig
  const story = new StoryService(storyConfig, quests, daytime,
    new StoryInteractions(storyConfig, quests, dialogue, messages.show))
  const services: GameServices = {
    story,
    vehicles: new VehicleSearchService(
      dialogue,
      inventory,
      quests,
      id => currentCharacter()?.skills[id as keyof Character['skills']] ?? 0,
      () => daytime.getSnapshot().phase === 'night'
    ),
    audio: new AudioService(audioConfig),
    statistics,
    perks,
    notes,
    loading,
    messages,
    options: createSessionOptions({
      options, references, saved,
      getCharacter: () => character,
      getDifficulty: () => difficulty,
      selectDifficulty: id => { difficulty = difficultyRules(id) },
      getAwakePhases: () => sleepState.awakePhases,
      status, travel, daytime, inventory, quests, statistics, perks, notes,
      dialogue, lockpicking, messages, story,
    }),
    quests,

    /**
     * Read live skill modifiers derived from the selected character.
     * @returns {object} The result described by the TypeScript return signature.
     */
    get skillEffects() {
      return skillEffects()
    },

    /**
     * Read the current character including carried and temporary effects.
     * @returns {Character | null} The result described by the TypeScript return signature.
     */
    get character() {
      return currentCharacter()
    },

    /**
     * Read the selected difficulty, including changes made during class selection.
     * @returns {object} The result described by the TypeScript return signature.
     */
    get difficulty() {
      return difficulty
    },
    lockpicking,
    status,

    chooseClass: createClassSelection({
      getCharacter: () => character,
      setCharacter: value => { character = value },
      setDifficulty: value => { difficulty = value },
      getTracking: () => tracking.enabled,
      setTracking: value => { tracking.enabled = value },
      difficultyId, saved, rest, daytime, status, inventory, perks, dialogue,
      sleepState, definitions,
    }),
    rest,
    daytime,
    travel,
    dialogue,
    inventory,
    hud: new HudService(UI_CONFIG.menus.filter(menu => menu.id !== 'inventory').map(menu => menu.id)),
  }
  observeCharacterLimits({
    getCharacter: () => character,
    getDifficulty: () => difficulty,
    currentCharacter, inventory, status, perks, definitions,
  })
  startSessionLifecycle({
    services, saved, classId, inventory, quests, travel, lockpicking, status,
    notes, messages, daytime, statistics, story,
    enableTracking: () => { tracking.enabled = true },
    hasCharacter: () => character !== null,
  })

  return services
}

