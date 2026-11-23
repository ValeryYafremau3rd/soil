import { ATTRIBUTE_LABELS, SKILL_LABELS } from '../../domain/skills/character'
import type { Character } from '../../domain/skills/character'

/**
 * Perform condition penalties.
 * @param {{ current: Character restoredEnergy: Character restoredSanity: Character }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function ConditionPenalties({ current, restoredEnergy, restoredSanity }: {
  current: Character
  restoredEnergy: Character
  restoredSanity: Character
}) {
  return <>
    {([
      {
        label: 'Sanity',
        current: current.skills,
        restored: restoredSanity.skills,
        labels: SKILL_LABELS
      },
      {
        label: 'Energy',
        current: current.attributes,
        restored: restoredEnergy.attributes,
        labels: ATTRIBUTE_LABELS
      },
    ] as const).map(group => {
      const penalties = Object.entries(group.labels)
        .map(([key, label]) => ({
          attribute: label,
          amount: (group.restored as Record<string, number>)[key] - (group.current as Record<string, number>)[key]
        }))
        .filter(penalty => penalty.amount > 0)
      if (!penalties.length) return null

      return <section key={group.label} aria-label={`${group.label} penalties`}>
        <h3>{group.label}</h3>
        <dl>{penalties.map(({ attribute, amount }) => <div key={attribute}>
          <dt>{attribute}</dt><dd className="character-penalty">−{amount}</dd>
        </div>)}</dl>
      </section>
    })}
  </>
}
