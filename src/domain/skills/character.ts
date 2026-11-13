import skillConfig from '../../content/skills.json' with { type: 'json' }

export interface Attributes {
  strength: number;
  agility: number;
  intelligence: number;
  willpower: number;
  charisma: number;
}

export interface ClassDefinition {
  id: string;
  name: string;
  attributes: Readonly<Attributes>;
  startingItems: readonly string[];
  startingItemQuantities?: Readonly<Partial<Record<string, number>>>;
}

export const ATTRIBUTE_LABELS = {
  strength: "Physique",
  agility: "Concentration",
  intelligence: "Intelligence",
  willpower: "Willpower",
  charisma: "Charisma",
} as const;

export const SKILL_LABELS = {
  athletics: "Athletics",
  weapons: "Weapons",
  martialArts: "Martial Arts",
  scraper: "Scraper",
  lockpicking: "Lockpicking",
  stealth: "Stealth",
  medicine: "Medicine",
  erudition: "Erudition",
  intimidation: "Intimidation",
  persuasion: "Persuasion",
  barter: "Barter",
} as const;

type Skills = Record<keyof typeof SKILL_LABELS, number>;
export type SkillAttributeWeights = Record<keyof Skills, Record<keyof Attributes, number>>;

const attributeWeights = skillConfig.attributeWeights satisfies SkillAttributeWeights;

export function calculateSkills(attributes: Readonly<Attributes>): Skills {
  return Object.fromEntries(Object.entries(attributeWeights).map(([skill, weights]) => [skill,
    (Object.keys(ATTRIBUTE_LABELS) as (keyof Attributes)[])
      .reduce((total, attribute) => total + attributes[attribute] * weights[attribute], 0),
  ])) as Skills;
}

export function createCharacter(definition: ClassDefinition) {
  return {
    classId: definition.id,
    className: definition.name,
    attributes: { ...definition.attributes },
    baseAttributes: { ...definition.attributes },
    skills: calculateSkills(definition.attributes),
  };
}

export type Character = ReturnType<typeof createCharacter> & { skillModifiers?: Partial<ReturnType<typeof calculateSkills>> };

export function validateClasses(
  classes: readonly ClassDefinition[],
  itemIds: readonly string[],
): void {
  const ids = new Set<string>();
  for (const definition of classes) {
    if (!definition.id || !definition.name || ids.has(definition.id))
      throw new Error("Classes require unique IDs and names");
    ids.add(definition.id);
    for (const [id, quantity] of Object.entries(definition.startingItemQuantities ?? {})) {
      if (!definition.startingItems.includes(id) || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1)
        throw new Error(`Invalid starting item quantity for class ${definition.id}: ${id}`);
    }
    for (const key of Object.keys(ATTRIBUTE_LABELS) as (keyof Attributes)[]) {
      if (
        !Number.isInteger(definition.attributes[key]) ||
        definition.attributes[key] < 0
      ) {
        throw new Error(`Invalid ${key} for class ${definition.id}`);
      }
    }
    if (
      definition.startingItems.length < 3 || definition.startingItems.length > 6 ||
      new Set(definition.startingItems).size !== definition.startingItems.length ||
      definition.startingItems.some((id) => !itemIds.includes(id))
    ) {
      throw new Error(
        `Class ${definition.id} requires three to six distinct existing starting items`,
      );
    }
  }
}
