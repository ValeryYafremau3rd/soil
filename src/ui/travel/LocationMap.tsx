import type { TravelLocation } from '../../app/contracts/travel'
import './map.css'

export function LocationMap({ locations, currentId }: { locations: readonly TravelLocation[]; currentId: string }) {
  const ordered: TravelLocation[] = []
  const seen = new Set<string>()
  for (const root of [...locations.filter(location => !location.connections?.left), ...locations]) {
    let location: TravelLocation | undefined = root
    while (location && !seen.has(location.id)) {
      seen.add(location.id)
      ordered.push(location)
      const nextId: string | undefined = location.connections?.right
      location = locations.find(candidate => candidate.id === nextId)
    }
  }
  return <section aria-label="Location connections">
    <ol className="location-map">{ordered.map((location, index) => <li key={location.id}>
      {index > 0 && <span className="location-map__link" aria-hidden="true">{ordered[index - 1].connections?.right === location.id ? '↔' : '·'}</span>}
      <div className={`location-map__district ${location.id === currentId ? 'is-current' : ''}`} aria-current={location.id === currentId ? 'location' : undefined}>
        <strong>{location.name}</strong>
        {location.id === currentId && <span>You are here</span>}
      </div>
    </li>)}</ol>
    <p>Reach a connected district edge to travel on foot. Confirm the trip to continue.</p>
    <p>Walking costs one time phase. Edges without a connection stay closed.</p>
    <dl className="location-map__routes">{ordered.map(location => <div key={location.id}>
      <dt>{location.name}</dt>
      <dd>Left: {locations.find(candidate => candidate.id === location.connections?.left)?.name ?? 'No route'}</dd>
      <dd>Right: {locations.find(candidate => candidate.id === location.connections?.right)?.name ?? 'No route'}</dd>
    </div>)}</dl>
  </section>
}
