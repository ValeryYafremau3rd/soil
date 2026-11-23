import { ITEM_BY_ID } from "../../content/items"
import { LOCATIONS } from "../../content/locations"
import { NPCS } from "../../content/npcs"
import "./notes.css"
export const TABS = {
  locations: "Locations",
  people: "People",
  items: "Items",
  quests: "Quests",
  perks: "Perks",
} as const
export type Tab = keyof typeof TABS

/**
 * Perform name.
 * @param {"items" | "quests" | "locations" | "people" | "perks"} tab - The tab supplied to this operation.
 * @param {string} id - The id supplied to this operation.
 * @returns {string | undefined} The result described by the TypeScript return signature.
 */
export const name = (
  tab: Tab,
  id: string
) =>
  tab === "locations"
    ? LOCATIONS.find((location) => location.id === id)?.name
    : tab === "people"
      ? `${NPCS[id]?.name}${NPCS[id]?.dialogue?.barter || NPCS[id]?.dialogue?.barters?.length ? ' (Barter)' : ''}`
      : ITEM_BY_ID[id]?.name
