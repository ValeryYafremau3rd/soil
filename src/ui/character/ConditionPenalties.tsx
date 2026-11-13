import { ATTRIBUTE_LABELS } from '../../domain/skills/character'
import type { Attributes } from '../../domain/skills/character'

export function ConditionPenalties({ current, restoredEnergy, restoredSanity }: {
  current: Attributes; restoredEnergy: Attributes; restoredSanity: Attributes
}) {
  return <>
    {([
      { label: 'Sanity', restored: restoredSanity, attributes: ['intelligence', 'charisma'] },
      { label: 'Energy', restored: restoredEnergy, attributes: ['strength', 'agility'] },
    ] as const).map(group => {
      const penalties = group.attributes
        .map(attribute => ({ attribute, amount: group.restored[attribute] - current[attribute] }))
        .filter(penalty => penalty.amount > 0)
      if (!penalties.length) return null
      return <section key={group.label} aria-label={`${group.label} penalties`}>
        <h3>{group.label}</h3>
        <dl>{penalties.map(({ attribute, amount }) => <div key={attribute}>
          <dt>{ATTRIBUTE_LABELS[attribute]}</dt><dd className="character-penalty">−{amount}</dd>
        </div>)}</dl>
      </section>
    })}
  </>
}
