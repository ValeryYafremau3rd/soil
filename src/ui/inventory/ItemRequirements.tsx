import type { itemRequirementStates } from '../../domain/inventory/items'
import { SKILL_LABELS } from '../../domain/skills/character'

export function ItemRequirements({ requirements }: {
  requirements: ReturnType<typeof itemRequirementStates>
}) {
  if (!requirements.length) return null
  return <p>{requirements.map(({ skill, required, state }, index) => <span key={skill}>
    {index > 0 && ', '}
    <span className={`requirement-${state}`}>
      {SKILL_LABELS[skill]} {required}
    </span>
  </span>)}</p>
}
