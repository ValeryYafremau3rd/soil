import { useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import type { LoadingController } from '../../app/contracts/loading'
import type { DayTimeController } from '../../app/contracts/daytime'
import { DAYTIME_CONFIG } from '../../content/daytime'
import { UI_CONFIG } from '../../content/ui'
import './loading.css'

/**
 * Perform location loading.
 * @param {{ loading: LoadingController daytime: DayTimeController }} options - The options supplied to this operation.
 * @returns {Element | null} The result described by the TypeScript return signature.
 */
export function LocationLoading({ loading, daytime }: {
  loading: LoadingController
  daytime: DayTimeController
}) {
  const state = useSyncExternalStore(loading.subscribe, loading.getSnapshot)
  const time = useSyncExternalStore(daytime.subscribe, daytime.getSnapshot)
  if (state.phase === 'idle') return null

  return <div className={`location-loading location-loading--${state.phase}`} role="status" aria-live="polite" aria-busy="true"
    data-phase={state.phase} style={{ '--location-fade-duration': `${loading.fadeMs}ms` } as CSSProperties}>
    <span>{UI_CONFIG.locationTransition.label}</span>
    <strong>{state.locationName}</strong>
    <span className="location-loading-time">Day {time.day} · {DAYTIME_CONFIG.phases[time.phase].label}</span>
  </div>
}
