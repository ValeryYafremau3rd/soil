import { useSyncExternalStore } from 'react'
import type { TravelController } from '../../app/contracts/travel'
import { Modal } from '../components/Modal'
import { SelectionList } from '../components/SelectionList'
import './travel.css'

export function TravelMenu({ travel }: { travel: TravelController }) {
  const snapshot = useSyncExternalStore(travel.subscribe, travel.getSnapshot)
  if (!snapshot.menuOpen) return null
  if (snapshot.mode === 'walk') {
    const destination = snapshot.locations.find(location => location.id === snapshot.destinationId)
    if (!destination) return null
    return <Modal title="Travel" onClose={travel.closeTravel} className="travel-menu" hideHeader>
      <SelectionList label="Travel destination" items={[{ id: destination.id, label: `Travel to ${destination.name}` }]}
        onChoose={travel.travelTo} />
    </Modal>
  }
  return <Modal title="Bus routes" onClose={travel.closeTravel} className="travel-menu" hideHeader>
    <SelectionList label="Destinations" items={snapshot.locations
      .filter(location => location.id !== snapshot.currentLocationId)
      .map(location => ({ id: location.id, label: location.name }))} onChoose={travel.travelTo} />
  </Modal>
}
