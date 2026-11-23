import { ATTRIBUTE_LABELS, SKILL_LABELS, calculateSkills } from '../../domain/skills/character'
import type { Character } from '../../domain/skills/character'
import type { ReactNode } from 'react'
import './character.css'

/**
 * Perform character details.
 * @param {{ character: Character children?: ReactNode }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function CharacterDetails({ character, children }: {
  character: Character
  children?: ReactNode
}) {
  const baseSkills = calculateSkills(character.baseAttributes)

  return <div className="character-details">
    <h2>{character.className}</h2>
    <div className="character-details__stats">
      <section>
        <h3>Attributes</h3>
        <dl>{(Object.keys(ATTRIBUTE_LABELS) as (keyof typeof ATTRIBUTE_LABELS)[]).map(key =>
          <div key={key}><dt>{ATTRIBUTE_LABELS[key]}</dt>
            <dd className={character.attributes[key] > character.baseAttributes[key] ? 'character-bonus' : character.attributes[key] < character.baseAttributes[key] ? 'character-penalty' : undefined}>{character.attributes[key]}</dd>
          </div>)}</dl>
      </section>
      <section>
        <h3>Skills</h3>
        <dl>{(Object.keys(SKILL_LABELS) as (keyof typeof SKILL_LABELS)[]).map(key =>
          <div key={key}><dt>{SKILL_LABELS[key]}</dt>
            <dd className={character.skills[key] > baseSkills[key] ? 'character-bonus' : character.skills[key] < baseSkills[key] ? 'character-penalty' : undefined}>{character.skills[key]}</dd>
          </div>)}</dl>
      </section>
      {children}
    </div>
  </div>
}
