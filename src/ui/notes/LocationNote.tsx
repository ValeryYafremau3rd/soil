import { BUILDINGS } from "../../content/buildings"
import {
  CONTAINER_PLACEMENTS,
  CONTAINER_TYPES,
} from "../../content/containers"
import { LOCATIONS } from "../../content/locations"
import { ROOMS } from "../../content/rooms"
import "./notes.css"

/**
 * Perform location note.
 * @param {{ id: string }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function LocationNote({ id }: { id: string }) {
  const location = LOCATIONS.find((location) => location.id === id)!
  return (
    <>
        <h3>{location.name}</h3>
        <p>{location.description}</p>
        <h4>Buildings</h4>
        <ul>
          {location.buildings
          .filter((building) => building.enabled !== false)
          .map((placement) => {
            const building = BUILDINGS[placement.type]
            return (
              <li key={placement.id}>
                  {building.name} · {building.inner.floors.length} floors
                  {building.rooms?.length
                  ? ` · ${building.rooms.length} rooms`
                  : ""}
                </li>
            )
          })}
        </ul>
        <h4>Containers</h4>
        <ul aria-label="Location containers">
          {CONTAINER_PLACEMENTS.filter(
          (container) => container.locationId === id,
        ).map((container) => {
          const placement = location.buildings.find(
            (building) => building.id === container.buildingId,
          )
          const building = placement && BUILDINGS[placement.type]
          const room = building?.rooms?.find(
            (room) => room.id === container.roomId,
          )
          const whereabouts =
            container.space === "outside"
              ? "Outdoors"
              : [
                building?.name,
                room
                  ? ROOMS[room.type].name
                  : container.floor !== undefined
                    ? `Floor ${container.floor + 1}`
                    : undefined,
              ]
                .filter(Boolean)
                .join(" · ")
          return (
            <li key={container.id}>
                {CONTAINER_TYPES[container.type].name} · {whereabouts}
              </li>
          )
        })}
        </ul>
      </>
  )
}
