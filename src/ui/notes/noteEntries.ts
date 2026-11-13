import { ITEM_BY_ID } from "../../content/items";
import { LOCATIONS } from "../../content/locations";
import { NPCS } from "../../content/npcs";
import "./notes.css";
export const TABS = {
  locations: "Locations",
  people: "People",
  items: "Items",
  perks: "Perks",
} as const;
export type Tab = keyof typeof TABS;
export const ITEM_GROUPS: Record<string, string> = {
  Food: 'Consumables', Drink: 'Consumables', Medical: 'Consumables',
  Weapon: 'Weapons', Ammunition: 'Ammunition', Tool: 'Tools',
  Book: 'Books', Document: 'Documents', Clothing: 'Clothing',
  Supply: 'Supplies', Material: 'Materials', Scrap: 'Scrap',
  Valuable: 'Valuables', Quest: 'Quest items',
};
export const name = (tab: Tab, id: string) =>
  tab === "locations"
    ? LOCATIONS.find((location) => location.id === id)?.name
    : tab === "people"
      ? `${NPCS[id]?.name}${NPCS[id]?.dialogue?.barter || NPCS[id]?.dialogue?.barters?.length ? ' (Barter)' : ''}`
      : ITEM_BY_ID[id]?.name;
