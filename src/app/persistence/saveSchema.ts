import { FRACTIONAL_STATISTICS, STATISTICS } from '../contracts/statistics.ts'
import { WEATHER_TYPES } from '../../domain/character/weather.ts'
import { array, boolean, choice, number, object, optional, record, text } from '../content/schema.ts'
import { DAY_PHASES } from '../contracts/daytime.ts'
import { storyStateSchema } from '../content/schemas/story.ts'
const integer = number(0, true, Number.MAX_SAFE_INTEGER)
const stacks = array(object({ itemId: text, quantity: number(1, true, Number.MAX_SAFE_INTEGER) }))
const questParameters = object({ sourceId: text, destinationId: text, itemId: optional(text) })
export const saveSchema = object({
  legacyQuestPrerequisites: optional(record(array(text))),
  story: optional(storyStateSchema),
  gameVersion: optional(text),
  openingVersion: optional(number(1, true, 1)),
  escapeCluesVersion: optional(number(1, true, 1)),
  version: number(1, true, 1),
  savedAt: text,
  classId: text,
  difficultyId: text,
  daytime: object({
    day: number(1, true, Number.MAX_SAFE_INTEGER),
    phase: choice(...DAY_PHASES),
    weather: optional(choice(...WEATHER_TYPES))
  }),
  status: object({ health: number(0), energy: number(0), sanity: number(0) }),
  inventory: object({
    motherJournalVersion: optional(number(1, true, 1)),
    readBooks: optional(array(text)),
    barterAmmoVersion: optional(number(1, true, 1)),
    lootedCaches: optional(array(text)),
    legendaryBarterStock: optional(object({ visible: boolean, items: stacks })),
    deliveryVersion: optional(number(1, true, 2)),
    equipment: optional(record(text)),
    items: stacks,
    money: integer,
    currencyInInventory: optional(boolean),
    slotlessMoney: optional(boolean),
    keyItems: optional(array(text)),
    containers: record(object({ items: stacks, locked: boolean })),
    deposits: record(stacks)
  }),
  quests: array(object({
    parameters: optional(questParameters),
    questId: text,
    stageIndex: integer,
    completedDay: optional(number(1, true, Number.MAX_SAFE_INTEGER)),
    completedStageIds: optional(array(text)),
    deadline: optional(integer),
    failed: optional(boolean)
  })),
  travel: object({ locationId: text, phaseTravels: integer, storySeen: optional(boolean) }),
  courierBoard: optional(object({
    parameters: optional(record(questParameters)),
    day: number(1, true),
    offeredQuestIds: array(text),
    acceptedQuestIds: array(text)
  })),
  npcJobs: optional(object({
    parameters: optional(record(questParameters)),
    day: number(1, true),
    offeredQuestIds: array(text),
    acceptedQuestIds: array(text)
  })),
  perks: optional(object({
    buffs: optional(array(object({ id: text, expiresAt: integer }))),
    counts: record(integer),
    acquired: array(text),
    habits: record(object({
      lastUse: integer,
      lastPenalty: integer,
      sanity: number(0),
      willpower: optional(number(-100, true))
    }))
  })),
  statistics: optional(object(Object.fromEntries(Object.entries(STATISTICS).map(([id]) => [
    id,
    optional(number(
      0,
      !FRACTIONAL_STATISTICS.some(statistic => statistic === id),
      Number.MAX_SAFE_INTEGER
    )),
  ])))),
  notes: optional(object({ locations: array(text), people: array(text), items: array(text) })),
  awakePhases: optional(integer),
  intimidatedDays: optional(record(number(1, true, Number.MAX_SAFE_INTEGER))),
  adviceDays: optional(record(number(1, true, Number.MAX_SAFE_INTEGER))),
  unlockedDoors: array(text),
  position: object({
    locationId: text, x: number(0, false, 100000), y: number(0, false, 100000),
    buildingId: optional(text), roomId: optional(text), floor: optional(integer)
  }),
})
