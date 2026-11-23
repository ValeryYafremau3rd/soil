# Furniture catalogue

Parked vehicles use `small-car`, `bus`, and `big-car`, cropped from `transport/cars.png`. Their `action: "none"` keeps them decorative, with no interaction prompt. The sedan is in Living District, the bus in Center, and the cargo truck in Factory. Their JSON definitions own crop coordinates and display size; location furniture placements own position and scale.

Vehicle `groundOrigin` aligns the tire bottoms with the street while keeping the shadow below it. Their `platforms` arrays trace connected roof, windshield, and hood segments. Each normalized segment has `left`, `right`, and `top`; optional `rightTop` gives its right endpoint a different height for slopes. Omit `rightTop` for a flat surface. The existing single `platform` field remains supported.

Each JSON filename in `types/` is a reusable furniture type ID. All 34 objects in the three supplied sheets have configs. Streets use five scattered hiding spots per district: courtyard storage and a dumpster in Living District, shop/delivery storage and a street barrier in Center, and industrial supplies and barriers in Factory. Cover is spaced about 550–650 world pixels apart, with spots near both district approaches. Unused cover types remain available for authoring. Each district has one outdoor bench; vehicles retain their placements; apartments vary their chairs and sofas. Mattress and bed types remain available for authoring. Placement positions and type IDs are authored in each location or room file.

| Sheet | Type IDs | Interaction |
| --- | --- | --- |
| `bench.png` | `bench`, `bench-green`, `bench-armrests`, `bench-green-armrests` | Rest one phase |
| `bench.png` | `chair`, `chair-padded`, `chair-bentwood`, `armchair-padded`, `chair-armrests`, `chair-metal` | Rest one phase |
| `beds.png` | `bed`, `bed-striped`, `bed-double`, `mattress-quilted`, `mattress-striped` | Sleep until next morning |
| `beds.png` | `sofa`, `sofa-green`, `sofa-patterned` | Sleep until next morning |
| `hidden.png` | `cover-crate`, `cover-crates-stacked`, `cover-crate-large`, `cover-crate-draped`, `cover-crates-draped` | Hide / step out |
| `hidden.png` | `sandbags`, `sandbags-small`, `cover-barrel-rusty`, `cover-barrel-metal` | Hide / step out |
| `hidden.png` | `cover-barrier-striped`, `cover-barrier`, `cover-dumpster`, `cover-cases`, `cover-locker`, `cover-shelf`, `cover-pallet` | Hide / step out |

Place outdoor furniture in a location's `furniture` array:

```json
{ "id": "green-bench", "type": "bench-green", "x": 700, "space": "outside", "scale": 1 }
```

Place apartment furniture in a room's `furniture` array, using room-local coordinates:

```json
{ "id": "sofa", "type": "sofa-green", "x": 280, "scale": 1 }
```

Sleep furniture belongs indoors; cover belongs outdoors. New types are available automatically and only appear when placed. `crop` uses the sheet's `referenceWidth` coordinates and ends at the object's feet. `displayHeight` sets its base world size; type and placement `scale` multiply it. `platform` describes the standable top in normalized crop coordinates. Adjust that surface when changing the crop.

Indoor rest and sleep furniture is sized against the roughly 90-pixel indoor NPCs.
Chairs and sofas use a base `displayHeight` of 70, beds 85, and mattresses 55.
Room furniture also inherits the building scale and its authored placement scale;
the apartment building's 0.8 scale therefore gives a full-size chair a 56-pixel back.
Mattresses use a larger height than before so their horizontal length fits an adult.
