import { SKILL_LABELS } from '../skills/character.ts'
import type { DialogueChoice } from './dialogue'

/**
 * Put every requirement before reply text, independently of authored skill markers.
 * @param {DialogueChoice} choice - Reply containing optional trust and skill thresholds.
 * @param {string} text - Reply text after other presentation substitutions.
 * @param {number} trust - Hero's current trust with the speaking NPC.
 * @param {number} skill - Hero's effective level in the required skill.
 * @returns {string} Requirement badges followed by the editable reply text.
 */
export function formatChoiceRequirements(
  choice: DialogueChoice,
  text: string,
  trust: number,
  skill: number,
): string {
  const badges: string[] = []
  if (choice.trustRequirement !== undefined) {
    badges.push(`[Trust ${trust}/${choice.trustRequirement}]`)
    text = text.replaceAll('[Trust]', '').trim()
  }
  if (choice.skillRequirement) {
    const label = SKILL_LABELS[choice.skillRequirement.skill]
    badges.push(`[${label} ${skill}/${choice.skillRequirement.level}]`)
    text = text.replaceAll(`[${label}]`, '').trim()
  }

  return badges.length ? `${badges.join(' ')} ${text}` : text
}
