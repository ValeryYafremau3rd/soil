export const courierRoutes: Record<string, {
  sourceId: string
  destinationId: string
}> = {
  "courier-bartender": {
    "sourceId": "bartender",
    "destinationId": "citizen-mechanic"
  },
  "courier-cashier": {
    "sourceId": "cashier",
    "destinationId": "bartender"
  },
  "courier-citizen-caretaker": {
    "sourceId": "citizen-caretaker",
    "destinationId": "stranger"
  },
  "courier-citizen-clerk": {
    "sourceId": "citizen-clerk",
    "destinationId": "citizen-caretaker"
  },
  "courier-citizen-mechanic": {
    "sourceId": "citizen-mechanic",
    "destinationId": "citizen-nurse"
  },
  "courier-citizen-nurse": {
    "sourceId": "citizen-nurse",
    "destinationId": "citizen-clerk"
  },
  "courier-stranger": {
    "sourceId": "stranger",
    "destinationId": "worker"
  },
  "courier-worker": {
    "sourceId": "worker",
    "destinationId": "cashier"
  }
}
export const smugglerRoutes: Record<string, {
  sourceId: string
  destinationId: string
}> = {
  "dusan-crate-center-living": {
    "sourceId": "center",
    "destinationId": "living-district"
  },
  "dusan-crate-center": {
    "sourceId": "center",
    "destinationId": "factory"
  },
  "dusan-crate-factory-center": {
    "sourceId": "factory",
    "destinationId": "center"
  },
  "dusan-crate-factory": {
    "sourceId": "factory",
    "destinationId": "living-district"
  },
  "dusan-crate-living-district": {
    "sourceId": "living-district",
    "destinationId": "center"
  },
  "dusan-crate-living-factory": {
    "sourceId": "living-district",
    "destinationId": "factory"
  }
}
