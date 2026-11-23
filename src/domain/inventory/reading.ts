/** Stable aliases preserve books in older saves after the catalogue replacement. */
const READING_ALIASES: Readonly<Record<string, string>> = {
  "agility-training-handbook": "romance-book",
  "agility-training-pocket-guide": "romance-book",
  "agriculture-guide": "chemistry-medicine",
  "athletics-training-handbook": "anatomy-athletics",
  "athletics-training-magazine": "sport-magazine-athletics",
  "atomic-physics": "chemistry-erudition",
  "barter-training-handbook": "psychology-barter",
  "barter-training-magazine": "newspaper-barter",
  "botany-guide": "chemistry-medicine",
  "charisma-training-handbook": "chemistry-erudition",
  "charisma-training-pocket-guide": "chemistry-erudition",
  "chemistry-book": "chemistry-medicine",
  "encyclopedia": "chemistry-erudition",
  "erudition-training-handbook": "chemistry-erudition",
  "erudition-training-magazine": "health-magazine-erudition",
  "intelligence-training-handbook": "chemistry-erudition",
  "intelligence-training-pocket-guide": "chemistry-erudition",
  "intimidation-training-handbook": "psychology-intimidation",
  "intimidation-training-magazine": "newspaper-intimidation",
  "leather-journal": "chemistry-erudition",
  "lockpicking-training-handbook": "mechanics-lockpicking",
  "lockpicking-training-magazine": "technical-magazine-lockpicking",
  "machine-blueprints": "mechanics-scraper",
  "martialArts-training-handbook": "anatomy-martialArts",
  "martialArts-training-magazine": "sport-magazine-martialArts",
  "mechanics-book": "mechanics-scraper",
  "medicine-training-handbook": "chemistry-medicine",
  "medicine-training-magazine": "health-magazine-medicine",
  "old-newspapers": "psychology-barter",
  "paper-roll": "mechanics-lockpicking",
  "persuasion-training-handbook": "psychology-persuasion",
  "persuasion-training-magazine": "newspaper-persuasion",
  "red-book": "detective-book",
  "scraper-training-handbook": "mechanics-scraper",
  "scraper-training-magazine": "technical-magazine-scraper",
  "sewing-magazine": "technical-magazine-lockpicking",
  "stealth-training-handbook": "anatomy-stealth",
  "stealth-training-magazine": "sport-magazine-stealth",
  "strength-training-handbook": "fantasy-book",
  "strength-training-pocket-guide": "fantasy-book",
  "weapons-training-handbook": "mechanics-weapons",
  "weapons-training-magazine": "technical-magazine-weapons",
  "willpower-training-handbook": "chemistry-erudition",
  "willpower-training-pocket-guide": "chemistry-erudition",
  "workers-magazine": "technical-magazine-weapons"
}

/**
 * Perform reading item id.
 * @param {string} id - The id supplied to this operation.
 * @returns {string} The resolved text value.
 */
export const readingItemId = (id: string): string => READING_ALIASES[id] ?? id
