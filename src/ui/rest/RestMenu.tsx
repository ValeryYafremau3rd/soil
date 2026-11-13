import { useSyncExternalStore } from 'react'
import type { RestController } from '../../app/contracts/rest'
import { DAY_PHASES } from '../../app/contracts/daytime'
import type { DayTimeController } from '../../app/contracts/daytime'
import { DAYTIME_CONFIG } from '../../content/daytime'
import { Modal } from '../components/Modal'
import { SelectionList } from '../components/SelectionList'

export function RestMenu({ rest, daytime }: { rest: RestController; daytime: DayTimeController }) {
  const { menu } = useSyncExternalStore(rest.subscribe, rest.getSnapshot)
  const time = useSyncExternalStore(daytime.subscribe, daytime.getSnapshot)
  if (!menu) return null
  const current = DAY_PHASES.indexOf(time.phase)
  const title = menu.kind === 'sleep' ? 'Sleep' : 'Rest'
  return <Modal title={title} onClose={rest.close} className="rest-menu" hideHeader>
    <SelectionList label={title} items={[
      ...DAY_PHASES.map((_, index) => {
        const phases = index + 1
        const target = current + phases
        const phase = DAY_PHASES[target % DAY_PHASES.length]
        return { id: String(phases),
          label: `${menu.kind === 'sleep' ? 'Sleep' : 'Rest'} till ${DAYTIME_CONFIG.phases[phase].label.toLowerCase()}` }
      }),
    ]} onChoose={id => rest.confirm(Number(id))} />
  </Modal>
}
