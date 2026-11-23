# Editing game content

`dialogues/npc-directions.json` supplies the shared РІР‚СљWhere can I find...РІР‚Сњ topic for every NPC conversation. NPC names come from `npc/*.json`; answers use the current phase's resolved world placements and configured district, building and room names. The template nodes `topic`, `list`, `outdoors`, `building`, `room` and `unavailable` are required by the directory builder. Response text supports `{name}`, `{location}`, `{building}`, `{room}` and `{floor}`. No per-NPC dialogue links or location prose are needed. Disabled or unplaced NPCs receive the `unavailable` response. Investigations do not include this topic.

## Opening story

`ui/location-transition.json` keeps location loading covered until `readyFrames`
consecutive rendered frames each take at most `readyFrameMaxMs` milliseconds. This
allows initial scene setup and texture uploads to settle before the factory is revealed.
The existing `fadeMs` then controls the reveal; player and patrol actions stay blocked
until it completes.

`ui/story.json` defines the opening slides, public image paths, button labels and fade
duration in milliseconds. `sourceLocationId` and `destinationLocationId` select the
Factory-to-Center trip. Walking or bus travel queues the story, which appears only
after Center loads and its reveal finishes. Gameplay pauses until dismissal; saves
preserve completion and resume an unfinished arrival story after loading Center.

## Ending slides

`story.json.endingSlides` owns the twelve ordered epilogue slides, cycling backgrounds,
fade duration, navigation labels and narration variants. The UI freezes one resolved
text per slide from the final story snapshot, reuses the opening-slide layout, and
shows Save/Load/New game after Finish. Loading a completed save replays the sequence.
Text stays separate from artwork; no condition names are rendered.

Each slide has a `defaultVariant` and ordered `rules` selecting a variant from actual
`ending_route`, decision ID/value, or `absentNpcIds`. Absence rules precede safe
outcomes. Only the official/illegal departures, exposed transfer records, Dusan's
warning/arrest, Milena's detention, Elena's detention and Pavel's official cooperation
have special selectors. Queued arrests do not count as completed absences. Proposed
rescues, deaths, dismissals, resistance and factory-disaster texts are retained without
selection rules because gameplay cannot currently establish those outcomes. Unknown
residents use authored baselines, including loyal Zofia/Elena and Pavel in power.
Elena's approved detention variant prevents an absent resident from appearing at work.

## Audio

`events.ui` is shared by window transitions, tab and slot navigation, item actions,
dialogue selection, quick-slot hotkeys 1-9, native controls and lock-wheel changes.
Mouse and keyboard input use the same cue, including ending menus.
Feedback caused by one input task is played
once. Each new UI clip stops its predecessor; other effects and music keep playing.
Text typing, disabled controls and ordinary gameplay movement stay silent.
`tracks.ui.volume` is 0.125, half its previous 0.25 gain, before `masterVolume` applies.

`audio.json` assigns sounds from `src/sounds/`. `tracks` maps a stable ID to a path relative to that folder and a volume (0РІР‚вЂњ1); `masterVolume` scales all playback. New MP3 files are discovered by Vite. `events` maps `shot`, `meleeHit`, `meleeMiss`, `door` and `ui` to track IDs. Shots include hero and NPC fire; melee cues resolve when an attack lands or misses, and cancelled attacks stay silent. `running` selects the grounded hero movement loop, which stops for jumps, blocked movement, menus and death.

`locations` maps district IDs to ambient layers: each has a `track` and separate `outside`/`inside` gains (0РІР‚вЂњ1). City ambience is quieter inside buildings. Factory has both layers, with the interior layer quieter outdoors and the exterior layer quieter indoors. `nightAmbient` adds layers during the night in every district.

`events.wake` plays once after a completed sleep; cancelling sleep, ordinary rest and natural morning changes do not trigger it. `events.death` plays once when the hero's health reaches zero. Both use `other/new_day.mp3` by default.

`music.loading` loops during initial setup and startup loading. Later travel and door loading overlays preserve the current world soundtrack. Ambient and music loops keep playing while their conditions remain active; indoor volume changes (including zero volume) do not restart them. `music.daytime` alternates its tracks by day; `music.night` is empty by default. `pursuit.human` and `pursuit.monster` replace calm music during engagement; monsters take priority if both pursue. `spotted` maps patrol type IDs to notice sounds, falling back to `monster`. Titan has its own cue. Unknown track/location references and invalid volumes fail validation. Browsers may require a key press or click before sound starts. Audio stops and releases its resources when the session is replaced.

Edit JSON in this directory, then reload the game to start a new session with the new content. Existing sizes, positions, and dialogue have been preserved. Loot and inventory stay in memory across travel; reloading starts a new session.

| File | What to edit |
| --- | --- |
| `locations/<id>/index.json` | Location settings; building instances and placements live in adjacent subfolders |
| `buildings/*.json` | One building type per file: PNG views/crops, boundaries, floors, stairs, surfaces and base scale |
| `rooms/*.json` | One room per file: cropped artwork, name, floor height, movement bounds and optional standable surfaces |
| `furniture/types/*.json` | Seat, bed and cover artwork/crops, actions, size, prompts and optional standable tops |
| `npc/*.json` | One NPC per file: image, idle frames, size/scale, optional dialogue ID, portrait index and daytime schedule |
| `patrols/types/<id>/index.json` | Patrol sprite settings, combat, movement and optional corpse loot |
| `patrols/types/<id>/animations/*.json` | One animation per file: idle, walk, run, attack, death and optional shoot |
| `patrols/locations/*.json` | Per-district phase counts, normalized patrol bounds, scale and optional enabled flag |
| `containers/types/*.json` | One reusable container type per file: crop, name, size, scale and standable top |
| `containers/settings.json` | Shared container sprite sheet and interaction defaults |
| `taskboards/*.json` | Street/wall board artwork, crops, size, interaction prompt and target menu |
| `loot-tables/*.json` | One reusable random loot table per file |
| `items/<category>/*.json` | One item per file: ID, name, category, icon crop and icon scale |
| `dialogues/*.json` | NPC phrases, player replies, links to other phrases and closing choices |
| `hero/index.json` | Hero sprite asset, action IDs, matte, movement, combat and scale |
| `hero/outfits/<id>/index.json` | Outfit sprite asset; per-action frame crops live in its animations folder |
| `hero/outfits/basic/animations/*.json` | One hero action per file: frames, foot anchors and timing |
| `daytime.json` | Starting day/phase, HUD sprite sheet/crops, phase labels and scene tint colors/opacity |
| `settings.json` | Camera/canvas settings, world layers, dimming, light sources, hints, exit marker appearance, game keys and bus-stop sprite |
| `ui/*.json` | UI sections: inventory display, location transitions, menus, stats, selection keys, control labels, rest, perks and consumable buffs |
| `ui/lockpicking.json` | Lock-window text, timer polling, wheel animation and gesture thresholds |
| `difficulty.json` | Default difficulty and the three configurable Easy, Normal and Hard presets |

The TypeScript files beside the JSON are typed adapters and derived values. Authored settings belong in JSON. Startup validation reports invalid fields and references with their JSON path. No dependencies or per-content registration classes are needed for another building or NPC type.

`settings.json.lighting` controls Phaser point-light radiance for building entrances, corridor floors, occupied rooms, bus stops and taskboards. Each source has a color, pixel radius, base intensity, attenuation and vertical offset (positive moves up). `phaseIntensity` multiplies the base intensity: morning/evening 0.25, afternoon 0.1, night 0.5. Lights follow the active indoor/outdoor view; `depth` places the glow above daytime filters and below prompts. Daytime filter colors and opacity remain in `daytime.json.phases`. Buildings may set `corridorLights: false` to omit central floor lights while retaining room and entrance lights.

## Difficulty and character creation

Buildings may set `corridorTint` to an RGB integer (0РІР‚вЂњ16777215) to multiply the interior background colors. The apartment hall uses muted green-gray (`0xa6b49a`) for an uneasy atmosphere. Exterior and occupied room artwork keep their original colors.

Energy drain is ten times the previous pace: movement costs 0.005 Energy per pixel and 1 per jump; each elapsed phase costs 2.5 Energy and 0.01 Sanity before difficulty modifiers. Drain remains active above and below 50% Energy. Fractional phase costs are preserved. Rest/sleep still waive phase Energy costs, and combat and sleep-deprivation damage retain their existing settings.

New games show class selection first, followed by a separate difficulty screen. Gameplay begins only after both choices are confirmed. The selected preset remains fixed across travel, time changes and scene restarts. Restarting after death returns to class selection and asks for difficulty again.

`difficulty.json` contains exactly three presets and a `defaultId`. Preset modifiers scale the authored base values; `1` preserves the base. Militia walking and chase speed use `patrolSpeed`: Easy 0.6, Normal 0.8, Hard 1. Detection uses `patrolDetection`: 0.9 / 1 / 1.1. Monsters use only `monsterStrength` (0.9 / 1 / 1.1) for health, damage, walking/chase speed, detection, attack range and fear effects; cooldown and reaction delay divide by this multiplier so Easy monsters act more slowly. Other patrol modifiers apply to militia. Visual timing, sprite size, loot and population remain authored separately. Integer quantities are rounded to the nearest integer; starting vitals are clamped to the configured limits.

Base hero attack damage, range, hit feedback and fall settings remain in `hero/index.json.settings`. Patrol health, attack damage/range, cooldown, reaction time, death hold, pursuit speed and hit feedback remain in `patrols/types/<id>/index.json.combat`. Starting Health/Energy/Sanity and their independent maximum values are in `ui/stats.json`; the preset scales starts individually and caps with `maximumStats`. No service or HUD assumes a maximum of 100. Item recovery stays in each item JSON and is scaled by `itemRecovery`, with the actual effect shown in inventory.

Rest and sleep can restore all three vitals through `ui/rest.json.healthRecovery`, `energyRecovery`, and `sanityRecovery`, each with `rest` and `sleep` amounts. Rest amounts are points; sleep amounts are percentages of current vital limits per elapsed phase: 50% Energy, 10% Health and 10% Sanity. Base Energy recovery is 15 for rest and 50% per phase for sleep; difficulty applies its recovery modifiers once (Easy 23/75, Normal 15/50, Hard 9/30). Rest and sleep do not consume Energy while advancing time. `daytime.json.statCostsPerPhase` supplies travel Energy costs and elapsed Sanity costs. The difficulty screen previews starting vitals, attack damage and rest/sleep Health recovery before confirmation.

Each location's `background.scrollFactor` controls horizontal parallax using Phaser's `setScrollFactor()`. `0.7` moves scenery at 70% of the camera's scroll; `1` scrolls normally, and `0` stays fixed horizontally. Omitting it defaults to `1`. Vertical scrolling stays at `1` to preserve ground alignment. Background image size still determines world bounds.

`settings.json.scene.groundScreenRatio` controls vertical camera framing. The default `1` places the street ground line flush with the canvas bottom. The canvas is bottom-aligned above the menu bar, including when its aspect ratio leaves unused space. This crops extra pavement below the ground without changing authored object coordinates, platforms or building floors.

Files are discovered automatically. A definition's filename is its ID: `buildings/house.json` is referenced as `"type": "house"`. Item and location files also contain an `id`, which must match their filename. Location `order` controls bus-menu order; the first location is the starting location. Equal or omitted orders sort by filename. Reload after adding files. Shared hero, UI and world settings remain in their own files.

## Containers and manual items

Permanent carried-buff items are distributed between vendor purchases, locked caches and rooftop caches. Consumable effects remain daily supplies. Each district has two trashbins; their `street-supplies` pool refills at night and generates only items without stats: no attribute/skill bonuses, recovery effects, resistances, stealth modifiers, weapon stats or bag capacity. Statless sale valuables, supplies and ammunition remain eligible. This filter applies to all trash loot tables, including non-restocking bins, and does not affect player deposits. Vendor authored offers include equipment and consumables and refresh each morning; legacy category-only stock keeps single-stack goods finite. Medical crates in the barracks and supply crates in the bar, factory and shop refill each morning.

Permanent buff equipment has authored sources outside the developer container; readable issues, novels and tomes also appear in shops and loot. Permanent buff gear is excluded from renewable container random pools; fixed container sources must use `restock: false`. The apartment service-pistol safe and developer-stock container are finite. Taken gear remains depleted through refreshes and saves; food, medicine, drinks and other consumables can replenish.

Ordinary apartment permanent-buff rewards belong in finite safes. The Weapons magazine, Pliers, Practical lock notes and Repair pliers are split between the existing safes in apartments 22, 32, 42 and 52 respectively. Their former reward suitcases remain empty. The safe containing the Scraper magazine and Medical coat is in apartment 31, relocated from apartment 21.

Set `"restock": false` on a location container for finite contents. These containers start stocked even outdoors in daylight and retain depletion, unlocked state and stored items through morning/night changes and saves. Rooftop rewards are unlocked; ordinary locked reward caches require lockpicking. Existing quest caches retain their quest rules. Reloading content starts a fresh session; existing saves retain their saved contents.

Weapons and improvised melee tools define `damageMultiplier` from 0.9 to 1.5. This multiplies attack damage after difficulty and skill effects, alongside the attack timing bonus. Number keys 1-9 and quick-slot buttons apply the same action as Enter in inventory: equip gear, consume or read items, scrap materials, or inspect keys and letters. Equipment swaps preserve requirements and capacity checks. F/G use the same hold/release timing with the strongest eligible carried melee weapon or loaded firearm (highest damage multiplier; inventory order breaks ties). Unarmed attacks use 1Р“вЂ” weapon damage. Training books are not weapons.

Item balance uses the nine-point class attributes as its baseline. Everyday supplies require Erudition 2; practical training is an easier alternative to education for specialist items. Specialist skill requirements never exceed 10; Erudition requirements remain capped at 20. Ordinary tools, clothing and weapons give small related skill bonuses. Selected epic and legendary equipment can instead grant a related +1 attribute bonus: Horseshoe charm grants Strength, Service pistol grants Agility, Tool roll grants Intelligence, Military coat grants Willpower, and Triquetra pendant grants Charisma. Each attribute has exactly one non-reading equipment source; training books remain separate. Prices, recovery, quality, assets, stack limits and bag capacity retain their authored values.

Items support a single `bonus` and an optional nonempty `bonuses` array. Each entry targets one attribute (1РІР‚вЂњ3 points) or skill (1РІР‚вЂњ10 points). Multiple different targets on one item are allowed; duplicate targets on that item are rejected. Every carried nonconsumable item type contributes all its bonuses immediately, without checking Erudition, skill requirements or item knowledge. Duplicate copies give no extra bonus. All bonuses end on removal and attribute-derived skills recalculate normally without healing.

Reading uses 26 consumable Book items: eleven magazine/newspaper issues (+1 to one skill), four genre novels (+1 to each listed skill), and eleven science tomes (+2 to one skill). Sport covers Athletics, Martial arts and Stealth; Health covers Medicine and Erudition; Technical covers Weapons, Scraper and Lockpicking; Newspaper covers Persuasion, Barter and Intimidation. Detective grants Intimidation/Weapons/Lockpicking; Romance grants Persuasion/Stealth; Sci-fi grants Erudition/Scraper/Medicine; Fantasy grants Athletics/Martial arts/Barter. Chemistry covers Erudition/Medicine; Mechanics covers Lockpicking/Weapons/Scraper; Psychology covers Persuasion/Barter/Intimidation; Anatomy covers Stealth/Athletics/Martial arts. Each science skill has its own tome. Issues and novels require Erudition 4; tomes require 10. `readable: true` consumes one selected copy and records the item ID in saved `inventory.readBooks`. A title, issue or tome can be learned once per hero; duplicate copies remain unreadable after learning and may be stored or sold. Unread carried books grant no passive bonus. Learned bonuses persist without a carried copy and retain their exact authored amount, including with Legendary Erudition. Inventory and Notes show Read/Unread status. Older book IDs, stored copies, deposits and discovered notes migrate to replacement IDs without granting reading progress.

Valuables use Barter as their normal skill requirement (3 to 10 by appraisal complexity), with higher education as the alternative appraisal route. There is no separate full-value sale gate. Every unknown item sells for exactly 1; understood items use ordinary sale pricing, and vendor purchase prices remain configured. Protected goods cannot be sold and ordinary storage remains free. Sale-focused valuables without buffs have common loot rarity so players can earn money by recognizing frequently found goods. Unknown inventory names and slots are grey. Only understood nonconsumable carried-buff equipment shows tier colors: common white, uncommon yellow, rare green, epic blue, legendary purple. Understood sale-only valuables are gold. Consumables, ammunition, scrap, keys and other plain items stay neutral. Colors update immediately when knowledge changes. Selection uses an inner highlight and unusable items use a red exclamation marker so rarity remains visible. Symbolic gear with buffs retains its authored rarity. Postcards, marked maps, handwritten letters, sealed documents and radio meters are valuables with existing artwork; their skill requirements, hidden effects and displayed prices follow the same knowledge rules.

Carried effects, including bag capacity, apply once per item type. Duplicate copies occupy slots but provide no additional effects. Different bag types combine their extra slots; removing the final copy of a needed bag is blocked until the remaining inventory fits.

Symbolic items can set `fearResistance` to 5РІР‚вЂњ20 (integer percentage points). Carried nonconsumable item types add together without requirement checks, once per type, up to 100%. This reduces monster fear aura, detection shocks, and monster attack Sanity damage; physical Health damage and ordinary elapsed Sanity costs are unaffected. Inventory and Notes show each item's value; Character Combat shows the total.

Clothing may set `stealthModifier` to an integer from -10 to 10, excluding zero. It adjusts Stealth alongside the existing `bonus` while carried, without requirement checks, once per item type. Quiet clothing uses positive values; noisy or conspicuous clothing uses negative values. Removal ends the modifier. Effective skills stay at least 1. The Character menu shows the resulting detection range as a percentage of normal enemy range; lower is better.

Apartment 21 in Living District (`rooms/house-21.json`) includes the unlocked developer safe, moved from apartment 51. `developerStock: true` supplies one full stack of every catalogue item, including protected and quest items, and automatically includes newly authored items. Developer stock is finite; taken items stay depleted through refreshes and saves, while player deposits remain preserved.

Item `skillRequirements` sets practical gates for specialist items and equipment, for example `"skillRequirements": { "lockpicking": 8 }`. Skill keys exclude Erudition. These requirements govern item knowledge and active use; Inventory, Notes and barter inspection show the same effective thresholds. Unknown items retain their names while their effects stay hidden. Failed active use spends no supplies. Non-reading passive bonuses follow the existing equipment and carried-item rules. The legacy `requirementMode: "any"` format remains supported for compatibility, but authored items do not use it.

Food, drinks, bandages, balm and ordinary supplies have no skill or Erudition requirements, so living heroes can recover even with depleted attributes. Currency, keys, quest items, materials and scrap also have no requirements. Treatments use Medicine, firearms and ammunition use Weapons, tools use their relevant technical or physical skills, and valuables use Barter. Bags retain their existing capacity behavior. The item JSON owns each threshold.

Quest definitions can set `findItem` to an item ID for a find-and-deliver request. Use one dialogue stage requiring and removing exactly one of that item, and link the NPC reply as usual. Do not author a fixed reward: payment is exactly twice the configured item price for every rarity, independent of Barter. `daytime.json.findItemMaxPrice` caps new board requests at 20. Taskboards share one find-item notice; an active find-item request blocks further notices until completed. Previously accepted expensive requests remain completable. The content loader adds a request for every saleable item with a positive price, alongside courier notices. New item files are included automatically. Authored requests can customize the recipient and wording; remaining requests go to Dusan Markovic. Protected keys and quest goods are excluded. They pay only on handover and cannot be completed twice. These one-time requests do not use daily courier slots.

The Notes menu (`N`) records visited locations, people spoken to, and acquired item types. Discoveries persist in saves. Its Locations, People and Items tabs show descriptions, buildings, NPC routines/advice and item properties.

Item `saleable` defaults to true. Set it to false for keys and quest goods; vendors reject sales while ordinary container storage remains available. Carried bag slots appear in a separate frame beneath the six base slots.

Legendary Barter makes carried Thalers slot-free. The money total remains available
for purchases and travel, while money stacks are hidden from the carried grid.
Rewards, loot pickups and sale proceeds use the same exemption. Saves retain the
ordinary money stacks and a `slotlessMoney` compatibility flag. Losing the perk
restores their slot cost without discarding cash; excess stacks remain accessible
in an overflow section until room is made. Ordinary item capacity is unchanged.

`daytime.json.sleepDeprivation` defines the grace period in phases (4) and extra Sanity loss per overdue phase (5). Only sleeping resets this counter. Sleep restores 20 base Sanity through `ui/rest.json.sanityRecovery.sleep`; bench rest restores none. Ordinary elapsed Sanity costs still apply during both actions. Saves retain the time spent awake.

Menus capture hero controls while world physics, animations, patrols and attacks continue. Opening inventory, dialogue, travel, rest, quests, Notes, options or lockpicking does not provide a combat pause.

Location folders use this layout (files are discovered automatically):

- `locations/<id>/index.json`: ID, order, background, bus stop, connections and optional NPC/spawn.
- `locations/<id>/containers.json`, `furniture.json`, `taskboards.json`: arrays of outdoor placements in world coordinates.
- `locations/<id>/buildings/<instance-id>/index.json`: building instance ID, type, entranceX, scale and enabled flag.
- Within each building folder, the same placement arrays use local building coordinates. Do not specify locationId, buildingId, roomId or space; ownership is inherited. Keep floor for building placements.
- `buildings/<instance-id>/rooms/<room-id>/containers.json`: room-local container overrides/additions with globally unique IDs. The room ID references the building type's room binding; floor is inherited. Room furniture continues to belong to the reusable room template.

Building-local x starts at the building artwork's left edge. Room-local x starts at the room binding's x. World x = entranceX + (room.x + local x - building.entranceX) * effective building scale; omit room.x for building placements. Placement scale and heightOffset also inherit the effective building scale. Moving a building therefore moves its contents. Room templates already use room-local coordinates and remain unchanged. Initial spawn and NPC schedules retain their existing local-coordinate conventions.

Omit placement files for empty categories. Each file contains an array; use item IDs from `items/`. Legacy flat location documents remain supported, but cannot coexist with a folder for the same ID.

Copy [examples/manual-container.json](examples/manual-container.json) into a location folder's `containers.json` array for a crate containing exactly three bandages and two bread items. Give each container a globally unique `id`. Its `type` references a file in `containers/types/`; its optional `lootTable` references a file in `loot-tables/`.

Set `"locked": true` or `"locked": false` on a container type or individual placement, including room containers. Placements override their type; omission defaults to unlocked. Locked containers require a lockpick and the lockpicking puzzle at any time of day. Their contents stay hidden until unlocked. Success unlocks the container for the rest of the session; press Enter again to open it. Failure or cancellation consumes one lockpick. Morning stock refreshes preserve the current lock state.

- `items` alone: exact authored items and quantities; no randomness.
- `lootTable` alone: roll from the named table on the container refresh schedule described below.
- Both: add the random roll to the explicit items; repeated item IDs stack.
- Neither, or `items: []`: an empty container.

Remove `lootTable` when you want manual-only contents. The default `scavenge` table rolls 1-3 distinct item types from the entire item catalogue. Set `itemIds` to an array such as `["bandage", "medicine", "bread"]` for a restricted pool, then set `minItems` and `maxItems`. New items automatically join tables using `"all"`.

Each item JSON has `rarity: "common"`, `"uncommon"`, `"rare"`, `"epic"`, or `"legendary"`. A loot table opts into weighted random selection with `"rarityWeighted": true`; `rarity-scavenge` is an example. The relative per-item weights live in `containers/settings.json.rarityWeights` (60 / 30 / 10 / 4 / 1 by default). Rolls select distinct item types without replacement. Tables without this flag retain uniform random selection.

Fixed caches (`restock: false`, nonempty manual `items`, no `lootTable`) keep their initial rewards until the first successful pickup. From the next morning onward they reroll the existing `rarity-scavenge` pool daily, filtered and weighted by container quality, including outdoor caches. Remaining original loot is replaced; player deposits survive. Opening or a failed pickup does not activate refresh. Activation persists in saves. Quest-gated containers, empty storage and developer stock are excluded. Existing auto-refill containers keep their schedules.

Renewable outdoor containers (`space: "outside"`) begin empty during the day, refill authored/generated loot once when night starts, and lose unclaimed loot at morning. Nighttime session initialization seeds them immediately. Indoor containers, room containers, and vendor stock still restore manual stock and reroll generated loot each new morning, including in unvisited locations. Sleeping directly to morning does not create a skipped night refill. Old generated stock is replaced rather than accumulated. Quantities deposited by the player survive refreshes and still respect item stack limits. When deposited and generated copies of the same item are mixed, withdrawals use deposited quantities first. Reopening a container and changing locations do not refresh it.

A building-folder container inherits `space: "inside"` and its building-instance `buildingId`; specify a zero-based `floor` unless it belongs to a room folder. Its vertical position comes from that floor. In a building folder, `x` is local to the building and must resolve inside the floor boundaries. Outside containers use `space: "outside"` and have no building/floor binding. Set `enabled: false` to omit a placement.

Optional container `heightOffset` raises its bottom above the ground or assigned floor, in local pixels for building/room folder placements, or world pixels outdoors (default `0`). The Living District's additional suitcase uses `153.45` to sit on its street taskboard. Only the safe defines a collision platform; the hero can pass through all other container types. Raised containers retain their loot interactions; loot interaction takes priority over the taskboard below.

`settings.json.interaction.minimumInteriorHeight` sets minimum interior collision clearance in world pixels (140 by default), after building scale. Buildings, all floors, and rooms raise their logical ceiling as needed; the resolved minimum also covers the normal hero height plus `interiorHeadroom` if the hero grows. Larger authored clearances remain intact. Entering buildings or rooms keeps the hero at the normal outdoor scale. NPC fitting and indoor patrol spaces use the same minimum clearance.

## Location loading

Entering and leaving buildings uses the same black fade overlay as location travel. The view switches while the screen is covered, with the building name shown on entry and the district name on exit. Movement and menu shortcuts pause until the reveal finishes. Locked doors still require unlocking before the transition starts. `ui/location-transition.json.fadeMs` controls each half of this fade as well.

Factory uses the exterior and interior views in `buildings/factory.png`, with two working exterior doors leading to the same interior. Its left ladder and right stairs reach separate catwalks; there are no separate factory rooms. `buildings/*.json.entrances` lists optional building-local ground-floor doors; omission keeps the single `entranceX` door. Optional `stairs` connections specify `fromFloor`, `toFloor`, `fromX`, `toX`, and `landingX`. Without `stairs`, the original single staircase connects consecutive floors. Use Enter at an exterior door and W/S at a ladder or stairs.

Location loading uses a full-screen black overlay with the destination name. `ui/location-transition.json.fadeMs` controls each fade (600 ms by default), and `label` controls the loading caption. Travel fades out before the old scene restarts, stays black through asset loading, then fades in once the new world is ready. Initial boot and loading a saved game begin fully black. World input and menu shortcuts pause until the reveal finishes.

## Saving and options

### NPC quest chains

NPC follow-up quests become available as soon as their prerequisites are completed.
There is no next-day wait between story jobs. Delivery phase restrictions, deadlines,
daily repeatable-job limits and delayed story consequences retain their own timing.

`npc/` and `uests/` are the authoritative NPC and quest folders. The former `npcs/`
and `quests/` folders are retained for reference and excluded from runtime discovery.
Keep the spelling `uests` in authoring paths. Stable NPC, quest, stage and choice IDs
remain unchanged. `_codex` is design metadata and is stripped at content assembly;
dialogue trees belong in `dialogues/`, never in NPC sprite/schedule files.

`story.json` owns executable completion flags, branch options, next-day consequence
delay, world-object placements, feedback and ending labels. Dialogue prose and
selectable branches live in the actual NPC dialogue JSON. `storyDecision` selects a
configured outcome; `questChoiceId` retains the original stage trigger for alternate
replies. `storyConditions` matches saved flags or decision values. Useful Citizens'
first objective explicitly requires completing First Steps before asking Pavel for
authorized work; his work reply appears after that tutorial is complete.

Stages with `worldInteraction` retain their historical trigger IDs but can only advance
through the named world object. Coordinates inside a building are building-local;
outdoor coordinates are world pixels. The locker and workshop are on the factory
ground floor; the patient register is in the barracks hospital. Convoy observations
require night. Prompts use the existing shared Enter selection and existing scenery.

Reporting Dusan, exposing patient records, or submitting apartment evidence schedules
the affected resident's absence for the next day. Absence overrides every normal phase
placement and NPC directory answer. Notices preserve original stage triggers, item
handover rules and clue recovery. Dusan's maintenance passage stays accessible after
confiscation. Apartment 11 deliberately contains both Milena's night placement and
the old pistol cache; her dialogue explains that arrangement.

After all three branch finales and The Last Night, the service gate accepts the Titan
key. The optional official bargain instead leads to a checkpoint handoff, a protected
`exit-permit`, and checkpoint departure. A `work-pass` never permits exit. Either exit
completes `way-out-of-town` atomically with its reward; official exit confiscates the
permit. The district canvas closes and the saved ending screen records `ending_route`
and `prologue_complete`. Optional jobs never gate departure.

The main escape quest records Viktor Petrov's missing-guard key testimony and Irina
Kovalenko's nighttime shadow testimony as independent `escape-clues` objectives.
Viktor's clue is available from his root dialogue and related job hand-in. Irina's
quest reply unlocks only after completing her factory chain through The Locked Workshop;
its prerequisites include her earlier jobs. Neither clue requires skills; collecting
both directs the player to defeat the factory creature
at night and recover its key. Optional Erudition/Sneaking 8 replies reveal extra lore,
and Pavel's Barter 8 topic explains official departures. Pavel also mentions his help
in work and evidence dialogues. Finding the key early skips testimony without inventing
it; official departure never requires either clue or a Titan kill. Saves mark the
expanded stage layout with `escapeCluesVersion: 1`; older key and finished stages migrate.

Saves include story facts, decisions, queued consequences and absent NPC IDs. Legacy
completed decisions receive configured safe defaults without replaying rewards.
Narrow compatibility exemptions preserve existing runs across the newly added
cashier, town-survey and tablet prerequisites; they do not grant prerequisite rewards.

After **Voices of the town**, Pavel Sokolov offers **Behind Closed Doors**. His briefing lists
four NPC apartments to investigate without revealing the evidence location. Finding the protected,
readable letter is enough to report back; visiting every suspect room is not required. The letter
uses a finite quest-gated container, and handing it over pays once through the existing quest
money rules. The normal apartment door locks and witness restrictions still apply.

Quest titles, descriptions, objectives and offer text refer to named residents by their
character names (for example, Pavel Sokolov), rather than role labels such as "the clerk".
Keep internal NPC, quest, item and choice IDs unchanged. Unnamed people and occupational
story details may retain their descriptions.

Quests can declare `prerequisites` (completed quest IDs), `offeredBy` (NPC ID), and `offerText` (overhead invitation). NPC dialogue choices use `acceptQuestId` to accept them; task boards exclude NPC-only offers. Existing `questId` replies handle item handover and atomic rewards. Chains reject unknown dependencies and cycles. Saves retain progress and reject skipped prerequisites.

Zofia Nowak offers the five-part `cashier-1` through `cashier-5` courier chain. Acceptance supplies regular delivery goods automatically in one inventory transaction; a full inventory leaves the offer available. The two deliveries in `cashier-4` are active together and can be completed in either order: duct tape to Pavel Sokolov and water to Irina Kovalenko. Both recipients remain available through story disappearances. Their consecutive stages share `parallelGroup`, and saved `completedStageIds` track individual handovers until the group is finished. Only then does the return-for-payment stage activate. Rewards include money, a flat cap, a canvas backpack, and the existing Work pass (now Courier night pass). Carrying `patrolPass: true` makes routine human patrol detection follow daytime rules; monsters and provoked combat remain dangerous. Delivery goods remain ordinary saleable items. There is no replacement-supplies shop or separate collection reply.

Stages may restrict `phases` and start/reset a saved `deadlinePhases` timer. A first stage with `trigger: { "kind": "accept" }` completes automatically when the quest is accepted. Timed quests declare `retryStage` and `retryTrigger: { npcId, choiceId }`; the retry reply appears only after failure and restarts without issuing goods. The journal shows deadlines and failed-run instructions. The last story job starts directly with collection at night, with no evening appointment. The last story job uses the shared Center shipment crate. The Center crate also serves smuggler and Dusan shipments. Living District uses one shared smuggler/Dusan shipment crate; Factory keeps its single warehouse shipment crate. Retired shipment crates migrate into their district crate with stored goods preserved. Each district has one outdoor rest bench. Each loot objective requires an actual pickup of its requested item, not unrelated crate goods or player deposits. Pickup starts a two-phase deadline (night plus next morning); handover is morning-only and payment is due before afternoon. After the chain, the board continues to use the one generic courier template. Earlier saved crates and the removed counter migrate into the shared crate while preserving stored goods.

Dusan Markovic offers three night shipments: a parts parcel beside Living District barracks, a ledger near Center's shop, then a locked precision core on the factory ground floor. Rewards are a flashlight + 8 money, three lockpicks + 12 money, then a rare Triquetra pendant + apartment 12/building keys + 20 money. His full authored barter stock is available from the first conversation, without completing any quests. Find him inside the factory during the day, in Center's bar in the evening, or in apartment 12 at night. Stable legacy quest/vendor/key item IDs preserve existing saves.

Dialogue `barters` defines extra vendor containers; `requiresQuest` gates stock and replies, with `barterId` selecting the shop. Existing daily stock and prices apply. Dusan sells Practical lock notes and pliers to provide a practical Lockpicking progression path for every class.

Shipment placements use `questId`, `nightOnly`, and optionally `lockRarity`. They open only for the active quest at night; even indoor night shipments clear at morning. Quest items cannot be sold or randomly looted. `skills.json.lockpickingMaxSumByRarity` sets maximum target sums: common 12, uncommon 20, rare/epic/legendary 27, respecting the three-dial puzzle limit. Locked containers derive rarity from contents unless overridden. Older saves initialize the newly added story crates and shops without resetting existing loot.

Opening the page shows a Main menu with **New game** and **Load**, navigated with Up/Down and Enter. New game continues to Class selection and then Difficulty. Load validates and restores the existing save slot; missing or invalid saves leave the menu open with an error. The world starts only after choosing an option. Death-screen New game and in-game Restart still return directly to class selection, keeping the saved slot.

Every confirmed sleep automatically saves to the existing save slot after recovery, elapsed time, sleep-debt reset and morning refreshes finish. Bench rest and cancelled sleep do not autosave. The death screen offers **Last save** to load that slot and **New game** to return to class selection. Missing, damaged or inaccessible saves report an error on the death screen; starting a new game keeps the saved slot.

The bottom Options button (O) opens Save, Load, and Restart. Up/down selects a button and Enter activates it. One versioned save slot is stored through `platform/storage/gameSaveStorage.ts` in this browser's local storage. Save and storage errors use the shared notifications. Restart returns to class selection without deleting the saved slot; Load replaces the session only after the saved data passes shape and content-reference validation.

Saves include class, difficulty, inventory slots and money, active/finished quest progress, current vitals, day/phase, location and partial bus progress, container/vendor contents and locks, player-deposited quantities, unlocked doors, and the hero's latest stable position (including building, floor, and room). Restoration applies inventory before equipment caps and vitals, preserves morning refresh accounting, and does not replay quest rewards. Scenes are recreated on load; transient combat, animations, open windows and active puzzles are not resumed. Saves with unsupported versions or missing/incompatible content are rejected without replacing the current game.

## Quests

`autoStart: true` adds a story quest to the journal when a session starts, including older saves without that quest. It never appears as a taskboard offer. A `pending` stage keeps an unfinished story objective active until its continuation is authored. **Find a way out of the town** starts automatically with a run east to Center. Arrival completes the opening location objective and reveals the search for a way out; acquiring the protected `strange-key` from a Titan corpse reveals the objective to discover what it opens. Titans use the same corpse interaction and lifetime as Militia.

Quest files in `uests/` are discovered automatically; each `id` must match its filename. Every taskboard shares the same daily courier offers and unaccepted story quests. Use up/down arrows to select a quest and Enter to accept it. Selection stops at the first and last available quest. Accepting adds the quest to the hero's Journal (J); story quests can only be accepted once. Journal tabs separate Active and Finished quests: left/right arrows switch tabs, and up/down arrows select quests. Names appear on the left; the right side shows completed stages and all current stages, hiding future stages. Progress lasts for the current game session and survives travel and time changes.

Each quest has `name`, `description`, and an ordered nonempty `stages` array. Each stage has a unique `id`, a `description`, and a `trigger`: either `{ "kind": "inventory" }`, or `{ "kind": "dialogue", "npcId": "bartender", "choiceId": "deliver-supplies" }`. Optional `requiredItems` and `removeItems` contain `{ "itemId": "rope", "quantity": 1 }` stacks. Inventory stages require `requiredItems` and advance when those items are carried, including items obtained before the stage starts. Dialogue stages advance only through the matching NPC and choice. Removing items is atomic and happens once when the stage completes; delivery rechecks inventory even if the collection stage is already complete.

Add `"questId": "bartender-supplies"` to the corresponding dialogue choice, alongside its ordinary `next` or `close` action. Quest replies appear only for the matching active stage and when its item requirements are met. Content validation checks quest, NPC, dialogue choice, and item references.

Optional quest `reward` supports `items` (item/quantity stacks), `money`, or both. Positive authored `money` enables a cash reward; the actual total is Barter + 0.5 Р“вЂ” Intimidation + 0.5 Р“вЂ” Persuasion, rounded down to whole Thalers using current effective skills, including eligible carried bonuses. Weights live in `skills.json.questMoneyWeights`. This replaces the authored amount, including calculated find-item rewards; item-only quests remain item-only. The board and journal show the current calculated reward, and turn-in recalculates it. Find-item offer eligibility still uses authored item prices and rarity multipliers. Turn-in checks space after removing delivery items and applies removals, the entire reward, and money in one transaction. If any reward quantity cannot fit, nothing changes: the quest remains active and a notification asks the hero to make room and retry. Rewards cannot be collected twice.

Session `messages.show(text)` provides the shared notification used by lockpicking, quest acceptance/progress/completion, and inventory errors. Notifications retain repeated attempts as separate messages, show up to three at a time, and expire after four seconds on screen. Each blocked item pickup or take-all attempt reports no free room; partial-stack capacity remains usable. Game windows use stable dimensions with scrolling for long content and viewport limits for smaller screens.

Previously itemless non-repeatable quests now include equippable completion rewards:
Zofia's first delivery grants a leather belt and her night delivery leather boots;
Irina's missing-supplies investigation grants a work jacket; Milena's journal search
grants a sun amulet; Dusan's final apartment job grants a precision screwdriver;
Well Trained grants a medal alongside its existing perk. The escape storyline has
a compass reward configured for eventual completion; its pending stage remains.
Existing cash and item rewards and radiant quest rewards are preserved.

## Rest, sleep and cover

New sessions start late at night outdoors at Factory's bus stop, using `busStop.x + busStop.spawnOffset`. An optional `initialSpawn` can select a room with `{ "buildingId": "apartments", "roomId": "apartment-21", "x": 150 }`; its position is local to the room and uses its building scale. Room exits return to the corridor on the correct floor. Bus trips arrive at the destination's bus stop. Walking right arrives just inside the destination's left edge; walking left arrives just inside its right edge. The inset uses the hero's configured `edgeMargin`, preventing arrival from immediately opening another travel confirmation. Loading restores the saved position instead.

Room files can own a `containers` array with `id`, `type`, local `x`, optional `scale`, `heightOffset`, `enabled`, `items`, and `lootTable`. Building, floor and room ownership are inherited from the room binding. Each building/room instance gets a separate persistent loot ID; room containers appear only while that room is open. They reuse normal container pickup, inventory and standable surfaces.

Apartment loot containers are ordinary containers, without shipment quest gates. Their existing locks, observation checks and contents still apply. Apartment-tip quests can track pickups from these containers while active without restricting access before acceptance.

Locations own a `furniture` array, using the same `id`, `type`, world `x`, `space`, optional `buildingId`/`floor`, `scale` and `enabled` fields as other placed props. The supplied districts each have an outdoor bench, a crate cover and sandbag cover. Room files own a separate local `furniture` array (`id`, `type`, `x`, optional `scale`), inherited by every bound building instance. Room coordinates and sizes follow the building scale.

Furniture definitions choose `action: "rest"`, `"sleep"`, or `"hide"`. Benches/chairs open a W/S/Enter confirmation menu for advancing one phase. Beds and sofas offer sleeping to the next day's morning, including when used during morning. Rest restores 15 Energy. Each sleeping phase restores 50% of maximum Energy and 10% of maximum Health and Sanity before difficulty and Medicine modifiers; configure amounts in `ui/rest.json`. Left-hand apartments have sofas cropped from `beds.png`; right-hand apartments use quilted or striped mattresses. Cancel/Escape changes neither time nor health. Labels are in `ui/rest.json`. Time skips refresh lighting and the NPC roster without restarting the scene or moving the hero out of a room.

Outdoor cover uses `hidden.png`. Enter freezes the hero on the first jump sprite and places that sprite behind the object. Movement, jumping and fighting remain blocked until another Enter restores the hero's front layer and idle animation. Definitions supply both `prompt` and `revealPrompt`; the PNG files are unchanged. A `platform` gives furniture a standable top. `settings.json.roomExitRadius` makes room-exit interaction precise so nearby beds and chairs remain usable.


Quest decision alternatives live inside a dedicated dialogue node. Its root entry uses
`questTopic: "<quest-id>"` and `next`, without `questId`, `acceptQuestId` or
`storyDecision`: entering the topic cannot advance a quest or commit a decision.
The topic is visible only while a matching child quest action is eligible. Back
returns without committing. Child IDs, `questChoiceId` aliases and saved decision
keys stay stable when moving replies; quest hints continue scanning nested nodes.

Two-way protective choices require skill 12: Diplomacy to warn Dusan, Sneaking to
conceal Elena's identity, and Barter to accept Pavel's departure bargain. The three-way
records decision requires Erudition 15 for quiet copies, Diplomacy 8 for handing the
papers to Pavel, and no skill for public exposure. Other negative alternatives have
no skill requirement. Existing item and quest gates still apply. Requirements are
shown as current/required skill and rechecked before any item or story transaction.

## Taskboards

Each `locations/NAME.json` can contain a `taskboards` array. Entries use a unique `id`, `type` (`street` or `inside`), world `x`, `space`, `heightOffset`, and optional `scale`/`enabled`. The location ID is inherited, just like container placements. An empty or omitted array adds no boards.

Street boards use `space: "outside"` and normally `heightOffset: 0`. Wall boards use `space: "inside"`, a building-instance `buildingId`, and a zero-based `floor`. `heightOffset` is the distance in world pixels from that floor to the bottom of the board. Validation checks that the wall board fits below the ceiling. Raised artwork remains interactable from its floor.

Definitions in `taskboards/` are discovered automatically. Their `space` must match the placement. They reuse the sprite preparation pipeline; an optional `outline` clips a silhouette in crop-local coordinates. A `platform` gives a street board a standable top. The current definitions open the available quest board; accepted jobs appear in the quest journal.

## Scale

Scales must be positive. A missing optional scale means `1`.

| Object | Scale settings |
| --- | --- |
| Building | Base `buildings/TYPE.json.scale` multiplied by `locations/NAME.json.buildings[].scale` |
| NPC | Outdoors: `displayHeight` times definition `scale` times resolved schedule/location scale. Indoors: `displayHeight` times definition `scale` times the hero's `roomScale / scale`, capped by ceiling headroom; schedule scale is not applied again. |
| Container | Type `displayHeight` times type `scale` times placement `scale` |
| Bus stop | `locations/NAME.json.busStop.scale` |
| Hero | `hero/index.json.settings.scale` outdoors, `roomScale` in every building and room; interior ceilings enforce a minimum clearance |
| Background | `locations/NAME.json.background.height` times background `scale`; this also sets world dimensions |
| Item icon | `ui/inventory.json.itemIconSize` times `items/<category>/ID.json.scale` |

For example, a definition scale of `0.5` and a placement scale of `1.5` produce a building scale of `1.2`. World coordinates do not automatically move when you resize a building or background: adjust placements as needed. Building geometry and standable surfaces do follow their object's effective scale.

Items currently live in inventory and loot menus, so item scale affects those icons.

## Buildings and sprites

A building definition supplies `sprites`, `outer`, and `inner`. Each sprite has its own texture `key`, PNG `path`, and background mode (`none`, `light`, or `dark`). A `crop` and `referenceWidth` let two views share one sheet. Crop coordinates are relative to the reference image width; runtime preparation normalizes them once.

Each view references its sprite `key`. Its `groundY`, `crop`, floor boundaries and ceiling values are local reference coordinates. List floors from the ground upward. `entranceX` is the exterior door's local coordinate; a location's `entranceX` places that door in the world. Multiple placed copies can use the same definition with different IDs and scales.

An exit marker stays at the ground-floor door while inside a building, even when the hero moves away. Leaving hides it. Configure its label, vertical offset and colors in `settings.json.exitMarker`; its position follows the building instance's entrance.

Stair fields apply to buildings with multiple floors. In a single-floor building they do not create a stair interaction. Place buildings in `locations/NAME.json.buildings`, using the definition's filename as `type`. Set a placement's `enabled` to false to omit it.

A building's optional `rooms` array binds room types to doors: `{ "id": "apartment-11", "type": "house-11", "floor": 0, "x": 192, "doorX": 300 }`. Coordinates are local to the building's reference image and inherit its effective scale. `x` places the room's left edge; `doorX` is the corridor door and the exit point inside the room. `floor` is zero-based. Room files supply a `sprite` crop, local `groundY`, and `bounds` (`left`, `right`, `ceiling`). All filenames are discovered automatically.

The apartment house binds ten rooms, left and right on five floors, to individual crops from `house_rooms.png`. Approach a door in the corridor and press Enter to open that room. Only the selected crop appears; `settings.json.roomShade` dims the rest of the building. Corridor containers and boards hide during room visits. Press Enter near the room's EXIT marker to return to the same corridor position and floor. Room walls and ceilings constrain movement; stairs and the building exit work after leaving the room.

Room crops start at x=192 on the left and x=884 on the right, with widths of 360 and 454 reference pixels. Bounds follow the room walls and ceilings; corridor door centers are x=302 and x=1188. Right-room NPC local positions include the 216-pixel crop-origin adjustment. Furniture and loot occupy free spaces around the painted furnishings, with smaller sofas in rooms 11, 21 and 41 and a smaller mattress in room 52. Room 21's suitcase rests on its wardrobe; room 52's reward suitcase rests on its bookshelf. Preserve their IDs and contents when adjusting layouts.

Optional room `widthScale` (positive, default 1) stretches only the room artwork horizontally from its left edge. Bounds and object x positions use the resulting room-local coordinates. All five left rooms use 1.1 for a 396-pixel displayed width; their contents and NPC positions have moved proportionally to preserve the layout. Heights, source crops and corridor doors stay fixed.

Apartment room doors are locked throughout the day; building entrances lock only at night. Carried matching keys open doors automatically, including the apartment 21 key given by the clerk during the work-and-housing conversation. Exits remain available. Enter at a locked door requires a Lockpick (item ID `lockpick`) and opens a puzzle using `assets/ui/lock.png`: left/right selects a highlighted digit and up/down changes it from 1РІР‚вЂњ9. The target and current sum appear to the left of the digits, with a draining timer bar above. Each attempt starts with three random digits. Match the target and press Enter to confirm, unlocking the door for that night and closing the puzzle; press Enter again to enter. Success keeps the lockpick. Submitting an incorrect sum, cancelling, or timing out closes the puzzle, leaves the door locked, and breaks exactly one lockpick. Each failed attempt consumes only one lockpick. A brief notification reports success, failure, or a missing lockpick. Lockpicks have no skill bonus, stack up to three per slot, and cannot be used directly from inventory. `skills.json.lockpickingBaseSeconds` plus `lockpickingSecondsPerPoint` times the current Lockpicking skill sets the timer. Classes can set optional positive integer `startingItemQuantities` for their listed starting item IDs; Safecracker starts with three lockpicks, a Lockpicking magazine and cigarettes. Pliers remain a separate nonconsumable tool granting +2 Lockpicking. Classes support three to six distinct starting item types.

## Attribute contributions to skills

The three classes each have nine base attribute points, with no attribute below one. Burglar has Physique 3, Concentration 2, Intelligence 1, Willpower 2, Charisma 1: a physically strong intruder. Safecracker has 1 / 3 / 2 / 2 / 1 in that order: precise, technically informed, and best at Lockpicking. Grifter has 1 / 2 / 2 / 1 / 3: socially skilled, attentive, and physically weaker. Starting equipment and money remain authored separately in `classes.json`. Starting kits give Burglar a crowbar, two canned meals and a Stealth magazine; Safecracker gets three lockpicks, a Lockpicking magazine and two red cigarette packs; Grifter gets a Medicine magazine, a collectible Postcard to sell and two medicine bottles. Each receives its configured money; the clerk gives the apartment and building keys during the opening work-and-housing quest. New heroes additionally receive a class-related utility item: rope for Burglar, pliers for Safecracker, and a briefcase for Grifter. These items start in inventory and can be equipped in their tool or bag slot. No starting item grants attribute points. Magazines provide their skill bonuses; the crowbar grants +2 Martial Arts and requires Martial Arts 5 or Erudition 8, allowing Burglar to use it without its own bonus.

Physique is the displayed name of `strength`, representing overall physical ability and endurance; Concentration is the displayed name of `agility`, representing attention, precision and controlled execution. Willpower is the displayed name of the existing `willpower` attribute. JSON fields, item IDs, buffs and saved habits retain that stable key. Skill weights live in `skills.json.attributeWeights`; each skill lists all five attributes with nonnegative integer weights totaling three. `domain/skills/character.ts::calculateSkills` applies the weighted sum for creation, equipment, conditions and perks.

| Skill | Formula |
| --- | --- |
| Weapons | 2 Willpower + Concentration |
| Martial Arts | 2 Physique + Concentration |
| Athletics | 2 Physique + Concentration |
| Stealth | 2 Concentration + Willpower |
| Lockpicking | 2 Concentration + Intelligence |
| Scraper | Physique + 2 Intelligence |
| Medicine | 2 Intelligence + Willpower |
| Erudition | 2 Intelligence + Willpower |
| Intimidation | Physique + Willpower + Charisma |
| Persuasion | 2 Charisma + Intelligence |
| Barter | 2 Charisma + Willpower |

Physique supports physical damage, endurance and Health; Concentration supports movement control, stealth, fine manipulation and Energy. Intelligence supports technical work and learning. Willpower supports resolve, patience and Sanity. Charisma supports social checks and trade. No skill relies on tripling a single attribute. Existing difficulty scaling, equipment eligibility, condition penalties and the Erudition cap still apply after these base formulas.

## NPCs and dialogue

NPC trust starts at 1, adds one per completed unique story quest for that NPC and one per `skills.json.persuasionTrustPoints` effective Persuasion points (5), and caps the combined total at 5. Persuasion bonuses are derived from current skills rather than saved as permanent trust.

`advice.json.entries` contains the shared advice pool. Each entry has a unique `id`, a `rarity` (`common`, `uncommon`, `rare`, `epic`, `legendary`), an integer `level` from 1 to 20, and `text`. Keep at least one level 1 entry and at least one of each rarity. Advice always succeeds: effective Persuasion unlocks all entries at or below its level, with a minimum of 1 and a maximum of 20. An entry is chosen uniformly from that pool, without a success roll. Rarity is shown with the NPC's response. All replies leading to the `advice` node share one request per NPC per day, including persuasion and intimidation variants. Other conversation remains available. Daily advice records persist in saves; intimidation still blocks further conversation until the next day.

Add a definition in `npc/NAME.json` and reference `NAME` in a location's `npc.type`. Set `npc.x` and optional placement `scale`. Set `enabled: false`, or omit the `npc` entry, for no NPC.

Put a conversation in `dialogues/NAME.json` and set the NPC definition's `dialogueId` to `NAME` (without `.json`). Files are discovered automatically. Omit `dialogueId` for an idle NPC with no conversation.

An NPC's optional `schedule` maps `morning`, `afternoon`, `evening`, and `night` to `{ "locationId": "center", "x": 950 }`. Each phase can move a character to another district or a different spot in the same district. Multiple characters can share a district. Travel and resting refresh the roster. Street NPCs appear outdoors; indoor NPCs appear only in their assigned building or room.

For an interior, add `buildingId` and optionally `floor` (defaults to zero); `x` then uses building-local coordinates. Add `roomId` instead of `floor` for a bound room; `x` then uses room-local coordinates. Positions follow building scale, and NPC height fits the available ceiling clearance. Example: `{ "locationId": "living-district", "buildingId": "apartments", "roomId": "apartment-41", "x": 170 }`.

Cashier works in `center-shop` and bartender in `center-bar` during morning, afternoon and evening. At night, Stranger uses apartment 11, Worker 31, Cashier 41 and Bartender 51. Apartment 21 stays free for the hero. Ambient patrol populations keep their separate district schedules. Each resident has a personal introduction, an `[Advice]` topic, and a `Tell about yourself.` topic describing the authored four-phase schedule.

Omit a phase to use the original location `npc` placement for that phase; omit `schedule` for a static character. A phase's `enabled: false` hides that character. A phase can override placement `scale`; otherwise it inherits the home placement's scale (or `1` if there is no home placement), multiplied by the NPC definition's base scale. Setting the original home placement's `enabled` to false disables that character's entire schedule. A character with a complete schedule does not need a home placement.

| NPC | Morning | Afternoon | Evening | Night |
| --- | --- | --- | --- | --- |
| Stranger | Living District, x=210 | Center, x=2200 | Living District, x=1250 | Apartment 11 |
| Worker | Living District, x=410 | Factory, x=1020 | Center, x=1000 | Apartment 31 |
| Cashier | Shop interior | Shop interior | Shop interior | Apartment 41 |
| Bartender | Bar interior | Bar interior | Bar interior | Apartment 51 |

A dialogue has a `start` node and named `nodes`. Each node contains NPC `text` and player `choices`. Every choice has an ID, display text, and exactly one of `next` (another node ID) or `close: true`. NPC definitions can share a dialogue ID. Every resident now uses their own dialogue file, keyed by NPC ID.

The citizens sheet supplies four more scheduled residents: Mechanic (factory during the day, apartment 12 at night), Nurse (barracks and Center, apartment 22), Clerk (Center shop/bar, apartment 32), and Caretaker (Living District and barracks, apartment 42). Their full morning/afternoon/evening/night routes are in `npc/citizen-*.json`. Authored schedules keep at most two people in any Living District room, including the hero's reserved apartment 21.

## Skill effects

Energy and Sanity apply no penalty at or above 50% of their own maximum. Below that threshold, each missing percentage point applies a 2% penalty: 34% remaining gives a 32% penalty. Energy scales all attributes, including Willpower, before deriving skills; Sanity scales all resulting skills, including item bonuses. The thresholds in skills.json remain 0.5; sanityPenaltyStrength is 1. Attributes round down with a minimum of zero; skills round down with a minimum of one. Recovery restores underlying values without accumulating penalties. Vital maximums use unpenalized equipment attributes so resource loss cannot shrink its own cap or heal. Zero Sanity still immediately kills; ordinary recovery cannot revive the hero.

World drawing order is background, buildings/rooms, props and bus stops, hero, then NPCs and patrols. `settings.json.layers` controls shared depths; NPC/patrol definitions set their sprite `depth` (6 and 6.5). Lighting overlays and interaction hints remain above world sprites. Hiding temporarily places the hero behind the chosen cover prop and restores the hero depth when revealed.

Furniture types can override `depth` (default: the shared actors layer). The parked bus uses 0.25, above the background and behind buildings and other objects. Center's former bar-roof crate is now a toolbox on the parked bus roof at x=1100 and heightOffset=166; its ID remains unchanged for saved loot.

Only the four genre novels (Detective, Romance, Sci-fi and Fantasy) require `eruditionRequired`, currently 4. Specialist items and equipment use `skillRequirements` with relevant practical skills and no Erudition alternative. Food and basic goods have no requirements. Health magazines and chemistry tomes that teach Erudition require Medicine instead. Existing specialist thresholds remain in their item JSON; basic goods remain requirement-free. Erudition still reduces practical skill thresholds through `skills.json.educationRequirementReduction`; it is only a direct item requirement for novels.

`ui/stats.json` defines `attributeBonuses` entries with `attribute` and `pointsPerAttribute`. Each Physique point adds 5 Health and 5 Energy; Concentration adds 5 Energy; Charisma and Intelligence each add 5 Sanity. Each Willpower point adds 3 Health, 3 Energy and 3 Sanity. Bonuses apply to starting values and maximums after difficulty scaling. Starting equipment is included in the creation preview. Later inventory changes update caps without granting recovery; removing an attribute bonus clamps excess current points to the lower cap. Rest and consumable recovery use these effective caps.

`skills.json` configures per-point rates (default 0.05). Modifiers use final skills including carried-item bonuses and update immediately when inventory changes. Ten points gives a 50% bonus, not compounded growth. Athletics multiplies running speed and jump height; the jump duration stays configured. Weapons multiplies ranged damage, and Martial Arts multiplies melee damage after difficulty scaling. Damage rounds to the nearest integer. Stealth reduces the nighttime detection radius by 5% per point, stopping at zero.

Medicine multiplies recovery of Health, Energy and Sanity from every source after difficulty scaling, rounded to the nearest integer and capped at stat limits. Item and rest previews show the same amounts that recovery applies. The Medicine bonus is applied once, not again to an already adjusted preview.

Barter adds 5% of configured item value per point to sale prices, capped at 100% at level 20. Understood items sell for max(1, floor(base price * min(1, max(0, Barter) * skills.json.barter))). Purchases stay at configured prices, and sale prices never exceed purchase prices. Unknown items still sell for exactly 1. Containers and bus fares are unaffected.

## Patrols

The basic human patrol is named **Militia**; the stable `patrol` type and animation IDs remain unchanged. Its optional `corpseLoot` list configures independent inclusive `{ itemId, min, max, chance? }` rolls. Optional `chance` (0РІР‚вЂњ1) gates each drop; omission always rolls the quantity. Militia and Soldiers each drop one bullet, bandage and red cigarette pack at 50% each, and one Red star badge (amulet), leather belt and leather boots at 5% each. Zero rolls are omitted. After the death animation, the final pose becomes a searchable corpse. Corpses disappear on the next time shift (a phase or day change), together with any unclaimed loot; entering a building hides outdoor corpses until the hero returns outside. If time advances during death playback, the dying patrol is removed without creating a corpse.

Corpse contents roll once and use ordinary free inventory pickup, capacity checks and stack limits. They never refresh or refill on reopening, and remain searchable when empty. Corpse windows are take-only: player items cannot be deposited or swapped into them. Traveling away removes the corpses and their unclaimed loot. Temporary corpse containers are excluded from saves; collected items remain saved normally. Loading starts a new location visit. Other patrol types retain their existing death behavior unless given corpse loot.

Patrol strengths and behavior are authored in `patrols/types/<id>/index.json` and its adjacent `animations/` files: Health, melee damage/range, speed, detection radius, cooldown, reaction delay, and animation timing. Difficulty applies its patrol modifiers to these values. `kind` distinguishes human patrols from monsters.

At night, each empty room or roomless building has a 50% chance to spawn one Octopus when the nighttime population is created. The per-district `emptyInteriorSpawn` config sets its type and chance. Its optional `excludedRooms` list uses building and room placement IDs; Living District apartment 21 is permanently excluded, even while the hero is away. Scheduled NPC occupants exclude their room or roomless building. Buildings with rooms roll for each empty room instead of their corridors. Legacy `interiors` bindings are retained but no longer drive runtime spawning. Each district's patrol file has an `interiors` list with building/floor, phase counts, bounds within the walkable floor, and scale. These enemies are visible and active only in the matching building and floor; they cannot detect or attack through rooms, floors, or exterior walls. Ordinary officers remain outdoors. Indoor enemies can be hit with melee or firearms.

Monsters detect exposed heroes within their detection radius at any time of day and immediately pursue them, attacking once in melee range after their configured reaction delay. Monsters have a `combat.fear` aura whose radius must exceed their detection radius. Its `sanityPerSecond` drains Sanity in gameplay time, and `noticeSanityDamage` applies once when the monster newly detects an exposed hero. Paused gameplay, unavailable heroes, and dead or hidden monsters cause no fear damage. A completed monster hit also drains Sanity equal to half its actual Health damage. Fear damage follows the difficulty's patrol-damage modifier. Normal Octopus balance is 320 Health, 36 melee damage, 480 detection radius, and a 840-radius aura draining 4 Sanity/second plus 6 on notice.

Outdoor populations use additive `outdoorSpawns` entries with a type, phase counts, probability `chance`, and optional `shared`. Shared counts are totals distributed randomly across enabled districts, stable for each day and phase across travel. Center and Living District always have 2 Soldiers and 1 Militia. At night each independently rolls a 50% chance of three Octopuses and a 50% chance of one Fly. Factory has 2 Soldiers and 1 Militia during daytime, one guaranteed Titan at night, and a 10% nighttime chance of the complete 2 Soldier / 1 Militia group. Entries with the same optional `chanceGroup` share their probability roll within a district, day and phase. Indoor rolls remain separate. Legacy `nightEncounters` tables remain supported. Soldiers use the supplied solider.png atlas, 150 Health, 23 melee damage and 30 ranged damage. Militia have 100 Health, 15 melee damage and 20 ranged damage. Human patrol health and damage are halved from their previous values; Soldier melee rounds from 22.5 to 23 under the integer damage rules. Their ranged.requiresProvocation is false, so engaged soldiers shoot without first being hit; omission preserves the Militia retaliation requirement. Human patrols cooperate against monsters, and monsters retaliate; attacks resolve at animation completion.

The hero's updated sheet has 44 configured poses across idle, run, jump, melee, shooting, hurt, and death. Hero crops use optional per-frame `scale` along with foot anchors to fit the shared canvas. Hurt interrupts actions and returns to movement after playback. Lethal damage takes precedence, keeps the final death pose, and opens the restart screen only after the actual animation-complete event.

Closely packed hero poses can use `excludeRegions` to clear a neighboring sprite fragment without narrowing the entire crop. Each rectangle uses unscaled coordinates relative to its crop; it must fit within that crop. The fourth run frame excludes only the lower-right neighboring boot, preserving its face and hands.

`patrols/types/patrol/animations/` defines the officer's idle, walk, run, melee, six-pose shooting and death animations from `patrol.png`. Officers retain their original walking speed of 55 world pixels per second and pursue at 320 before difficulty scaling, twice the original pursuit speed. Walk/run animation rates are 9/24 FPS. The run row contains seven distinct poses even though the sheet label says eight; crop the actual figures rather than splitting the panel evenly. Each patrol walks across its allowed range, pauses, then continues. At either end it pauses and turns around. Combat uses the run animation when closing distance. Melee and shooting damage apply once when their respective animations finish. Patrols have no conversation or standable collision surface.

At night outdoors, living patrols detect an exposed hero inside the circle defined by `combat.detectionRadius` (520 world pixels by default, twice the original radius). During an active fight, patrols inside detection range also join combat in daylight. Hitting a patrol alerts nearby witnesses even if the hit kills its target. Patrols outside detection range do not join; the skill-adjusted radius still applies. Detection and joining a fight do not permit officers to shoot. Unprovoked officers pursue and use melee within 60 pixels. Only officers damaged by the hero use firearms, out to 520 horizontal pixels for 20 base damage, including at close range. They can shoot heroes on low objects up to 120 pixels above or below their feet; higher ground prevents shooting. Melee retains its 20-pixel height tolerance. Both range and height are rechecked at animation completion, so reaching safe high ground makes a pending shot miss. Beyond shooting range they pursue. Reaction delay and cooldown are shared between attack modes; difficulty scales ranged damage alongside melee damage. Optional `shoot` frame definitions pair with `combat.ranged: { damage, range, heightTolerance }`; ranged range must exceed melee range. Hidden targets, different floors and building/room contexts cannot be hit, and leaving a context or defeating the shooter cancels a pending attack. Hiding behind cover from `hidden.png` prevents detection. Once detected, the hero cannot hide until outside every living patrol's detection radius; the nearby cover prompt explains this. Unprovoked patrols stop pursuing when detection is lost. Patrols attacked by the hero retain their existing retaliation behavior. Daytime proximity alone does not trigger combat, and outdoor patrols cannot detect the hero indoors.

Patrol crops use `anchorX`/`anchorY` for a consistent torso and foot position inside `frameSize`. The renderer places every crop on an equally sized canvas so walking, idle and facing changes do not shift the character. Optional per-frame `scale` corrects size differences between rows of the source sheet. Crop anchors are relative to that crop, before its scale is applied.

`movement.speed` is world pixels per second. Walk and pause duration ranges use milliseconds. Adjust the type's `scale` for every officer, or a district file's `scale` for that district. `backgroundThreshold` removes dark atlas backdrop pixels connected to each frame's edge. `backgroundMinGreenRed` distinguishes the cool backdrop from the warmer black uniform, preserving dark clothing. Optional `keepLargestComponent` removes isolated backdrop specks around each cropped character.

The filename in `patrols/locations/` is the district ID. `counts` supplies legacy per-location counts for all four phases; these are zero while additive `outdoorSpawns` owns the population. `bounds.left/right` are fractions of location width, clamped inside world edges. Omit a district file or set `enabled: false` for no patrols. Populations are resolved on arrival for the current day and phase. Patrols hide outside their occupied context and continue moving and attacking while menus are open.

## Jumping on objects

Container types can have a `platform`; building views and the bus-stop sprite can have `platforms` arrays. A surface uses normalized image coordinates: `{ "left": 0.08, "right": 0.92, "top": 0.14 }`. Values are between 0 and 1. They describe the object's standable top and follow its position and scale.

Container types can set `groundOrigin` from 0 to 1 (default 1) to align their art with the ground. Smaller values lower the sprite and its standable surface; trash cans use approximately 0.9167.

These are one-way tops: the hero jumps through them from below, lands while descending, and falls after walking off an edge. Remove a surface to make that object non-standable. NPCs never provide collision surfaces. Decorative tables and counters can be represented by surfaces in a building's inner view.

Add a normalized `bottom` below the surface's top to make a solid obstacle that also blocks the hero's sides and head. Buildings currently use only their broad one-way roof surfaces, without added solid rooftop fixtures.

Jump height is in `hero/index.json.settings.jumpHeight` and duration is in `hero/outfits/basic/animations/jump.json.durationMs`; ceilings still restrict jumps indoors. Tall objects can require a stepping stone. Foot anchors align idle frames without moving the physical hero.

`hero/index.json.settings.fallDamage` controls landing damage. The default safe drop is 140 world pixels; every additional 5 pixels costs 1 Health, rounded up. Distance is measured from the highest point of each uninterrupted fall and resolved once on landing. Normal jumps are safe. Landing on another platform starts a new drop; room changes, stairs and travel reset the measurement.

`daytime.json.statCostsPerPhase` controls time costs: 5% of maximum Energy and 5% of maximum Sanity per phase on Normal by default, scaled by the selected preset. Travel charges both costs for the phases actually advanced. Rest and sleep only charge Sanity for elapsed phases, including skipped phases when sleeping until morning, and recover Energy according to difficulty. Partial bus progress, canceling actions, opening menus and real-world idle time do not charge stats. Energy and Sanity stop at zero; recovery stops at their configured maximum values.

## Validation and verification

Bus travel to another district costs `daytime.json.busFare` money (default 1) per trip. Buses do not operate at night: stops cannot open bus routes, and the travel service rejects bus departures before charging money or advancing time. Walking remains available at night. Insufficient funds keep the route window open without advancing time or moving the player. Canceling, invalid destinations, choosing the current district, and walking are free.

Classes include `money` in `startingItems` and configure its amount in `startingItemQuantities` (Burglar 8, Safecracker 12, Grifter 16). Each item JSON configures a positive integer `price`; authored prices stay from 1 to 99 Thalers. Everyday food/drink costs 1РІР‚вЂњ8, medical supplies 3РІР‚вЂњ20, most clothing/tools 5РІР‚вЂњ40, books 3РІР‚вЂњ45, and firearms 70РІР‚вЂњ90. Training magazines/pocket guides cost 12 and handbooks 32; premium valuables reach 95. These are relative game prices, with everyday supplies cheaper than durable equipment and specialist books. Vendors are the stock definitions under `barter` in their dialogue files. Enter on vendor stock buys one item from the selected slot, charging its unit price when inventory has capacity. Insufficient money cancels the purchase. Enter on your items sells one item from the selected slot at the current Barter sale price. All sale prices have a minimum of 1, including understood price-1 items at any Barter level. The exchange shows your balance and transaction total. Ordinary containers still transfer items freely. Money survives travel, rest, and daily stock refreshes; a new character receives its class balance.

Time advances morning РІвЂ вЂ™ afternoon РІвЂ вЂ™ evening РІвЂ вЂ™ night after every two bus trips to a different location. Each location's optional `connections` config maps `left` and `right` to neighboring location IDs. Links must be reciprocal: A's right neighbor must link back to A on its left. Omit a side to disable travel at that edge. The configured route is Factory РІвЂ вЂќ Center РІвЂ вЂќ Living District; Factory's left edge and Living District's right edge do nothing. Reaching a connected outdoor edge opens a confirmation for that neighbor, with Travel and Stay here choices. Enter confirms; Escape cancels. Walking costs one full phase without a fare. It cannot skip intermediate locations. The Map window (M) draws these same configured connections and highlights the hero's current district. Bus travel retains its destination list and fare.

Any partial bus progress carries over. Canceling an edge confirmation leaves the hero free to move back into the location; it reopens after leaving and reaching the edge again. Interior walls never trigger travel. Choosing the current bus location, canceling travel, and entering buildings do not count. Night wraps to the next day's morning. Buses stop running at night; walking, rest or sleep can advance to morning. Six walking trips complete a day: one each for morning, afternoon and evening, then three at night. `daytime.json.nightDurationMultiplier` controls the night travel duration (default 3); rest still advances a full phase and sleep skips to morning. `daytime.json.travelsPerPhase` controls bus trips per phase; that file also controls the initial state and appearance. All phases use muted gray tints outdoors: morning has a subdued warm gray, afternoon a visible overcast gray, evening a cool slate gray, and night a dark charcoal overlay. Entering a building moves the daytime tint behind the occupied interior, preserving current outdoor lighting without extra dimming. Leaving restores the tint over the world. `settings.json.layers.daytimeTint` places the tint over the world and below interaction prompts; DOM menus stay readable.

Use focused verification from `tests/README.md`: content edits normally need `npm test -- content` plus the consuming module. TypeScript changes need typechecking and scoped lint; use a production build for bundler/asset integration. Invalid IDs, duplicate placements, quantities, scales, crops, floor references, dialogue links and loot counts fail early. Unknown configuration fields are rejected so typos do not silently change behavior. Definition and placement objects accept a `$comment` string for author notes.

### Resident names and courier jobs

Residents are Milena Vukovic (retired railway worker), Irina Kovalenko (factory worker), Zofia Nowak (cashier), Viktor Petrov (bartender), Dusan Markovic (mechanic), Nadia Morozova (nurse), Pavel Sokolov (clerk), and Elena Jovanovic (caretaker). Stable NPC IDs and schedules are unchanged.

Radiant jobs use exactly one template per type: courier-delivery, smuggler-delivery, and find-item. Quest destinations list eligible NPCs (courier/find) or district crate locations (smuggler). Offers roll sourceId and destinationId once; find-item also rolls itemId from saleable catalogue options within daytime.json.findItemMaxPrice. Runtime values live in daily ledger parameters and accepted QuestProgress.parameters, so reopening, changing days and reloading never change an active run. Templates use {source}, {destination}, {item}, $source/$destination NPC or container IDs, and $item item IDs; the service resolves these before dialogue, journal, rewards, and transactions.

Quest definitions support optional `repeatable: true`; stages support optional `grantItems` stacks. Item references and quantities are validated. Grant/removal and final rewards use a single inventory exchange, so a failed pickup leaves progress and inventory unchanged. Existing quest progress and inventory saves also preserve courier runs.

All five authored container types set `locked: false`. The optional boolean `locked` setting remains supported on types, placements, and room containers, including overrides. Door locking is unchanged. Existing saves preserve their saved container lock states; the new defaults apply when containers are initially seeded.
### Keys

Every class starts with one `key-ring` item, displayed as **Keys**, using its existing icon. Select it in standalone inventory and press Enter to open the key list. Escape or Back returns to inventory; the inventory hotkey closes either window. The default ring lists the Living District apartment 21 key (`apartments:apartment-21`) and apartment-building entrance key (`apartments`). Carried keys bypass matching door locks automatically, including at night, without spending lockpicks. Other doors and locked containers keep their existing rules. Storing the ring removes its building access until the ring is carried again. Keys cannot be sold. The existing apartment 21 lock exemption remains intact.

Item definitions may include a nonempty `keys` array of `{ id, name, doorId }`. IDs must be unique within the item, and door IDs must reference an authored building instance or `buildingId:roomId` door. The key list is derived from the carried item definition, so ordinary inventory saves retain ownership. The default ring sets `randomLoot: false` and occupies one inventory slot. Existing saves preserve their saved inventory; new class equipment is not retroactively granted.

Protected key rewards can set `attachToKeyRing: true`. Their keys attach to the existing `key-ring` instead of occupying another inventory slot. The Keys window combines these keys by door, and saves retain their source item IDs in optional `inventory.keyItems`. Storing the ring also stores access to its attached keys. Legacy separate carried key rewards attach when restored or picked up. Dusan's apartment 12 reward uses this behavior.

### Dusan's daily jobs

After smuggler-4, Dusan offers the single smuggler-delivery template with randomized source and destination districts. Every district has one Smuggler crate using existing crate artwork. Collect its Smuggler parcel at night, put it in the destination crate, and return to Dusan for payment. Pickup and deposit must be actual transfers; the wrong crate, unrelated goods, and withdrawing a player deposit do not count. Depositing advances the objective but never awards money. Crates remain accessible for ordinary storage, and their contents/deposits survive refreshes. Apartment loot remains ordinary loot rather than separate radiant tip quests.

Only one courier and one smuggler job may be active, independently of each other; story delivery quests count toward their type. Taskboards show one courier offer and one affordable find request at a time. Courier parcel and Smuggler parcel are the only shared delivery item types, protected from sale and random loot. Pickup issues one parcel, and failure removes that type from carried inventory, all containers, and deposit ledgers. Finished courier, smuggler, and find-item templates can run again on another day with new parameters. Find-item uses ordinary requested goods, rechecks them on handover, and pays the configured price/rarity reward atomically.

Vendor dialogue `barter.stock` selects goods by existing item `category`, using `{ categories, minItems, maxItems, minQuantity, maxQuantity }`. Add any always-stocked goods under `barter.items`; these are excluded from the random selection. At session start and each new morning, category-matching item types and quantities are rolled without duplicate types. Items with `randomLoot: false`, including personal keys and courier parcels, are excluded. Reopening barter, changing districts, ordinary phase changes, and night do not reroll stock. Saves restore the current stock and purchases. Remaining player-sold goods survive daily refreshes as before.

Viktor always stocks Spirits, Tinned beef, cigarettes and matches, plus 1-2 daily Food/Drink/Supply/Book goods. Zofia keeps Rope and an Encyclopedia plus 3-4 daily goods including reading material and medical supplies. Dusan keeps lockpicks, pliers, a precision screwdriver and Practical lock notes plus 1-2 tool/material/electronics goods. Fresh stock has at most six slots; player sales remain preserved. Random goods use one unit each. Stock refreshes once each morning.

The Encyclopedia requires Erudition 2 and grants +5 Erudition while carried, once per item type and within the existing cap of 20. Zofia stocks one every morning. It uses the existing textbook artwork and gives low-Erudition classes access to introductory reading. Removing it removes its bonus and rechecks dependent gear requirements.

The third row of items2.png supplies reference books and practical manuals with tiered, topic-appropriate skill bonuses. Scientific textbooks improve Erudition; chemistry and botany references improve Medicine; mechanical notes improve Scraper or Lockpicking. Light sources (flashlight, lighter, matchbox, wax candle, light bulb, and blowtorch) each grant +1 Willpower through the normal carried-item bonus rules. Matches are usable in stacks of five and grant +1 Concentration and -2 Sneaking for four phases or until sleep; reuse refreshes their duration without stacking. Plain batteries provide no passive attribute increases. The Enamel mug equips in the tool slot and grants +1 Willpower while equipped. Bandages and balm are universally usable; antiseptics and stronger medicines require relevant knowledge. White and red tablets provide temporary attribute tradeoffs rather than immediate recovery.
### Scrap, stronger equipment, and container quality

Items marked `scrap: true` are non-stackable consumable junk with `maxStack: 1`. Select one in standalone inventory and press Enter to spend exactly one unit. Scraper supplies the success chance: `skills.json.scrapping.baseChance + current Scraper * chancePerPoint`, capped at `maxChance` (defaults: 4% base, 4 percentage points per skill point, 90% cap). Failure spends the scrap and reports no useful recovery. Success replaces it with one configured useful reward. Ammo, tools, and medical supplies are possible; a Service pistol is a rare reward. Reward item rarities drive the configured common/uncommon/rare weights. Scrapping removes the selected scrap first, freeing its slot before adding a successful result. This works even when all six bag slots are occupied; ammunition can also merge into an existing partial stack. Scrapping does not occur in exchanges or consume other copies of the selected stack.

All items declare rarity. Inventory details show rarity and the live Scraper chance. Junk materials such as old wire, gears, bent nails, discarded papers, and loose nuts are tagged Scrap. Reward IDs, probabilities, rarity weights, scrap effects, and quantities are validated. Scrap has no carried bonuses or ordinary recovery effects.

Carried-item attribute and skill bonuses use the regular `bonus.amount` from each item JSON, once per distinct item type. Inventory and Notes show that same amount. Education requirements, condition penalties, Erudition caps, dynamic skill effects, and vital-limit clamping still apply. Raising equipment caps does not heal the hero.

Every authored item and container type requires an integer `quality` from 1 through 5. Defaults: trash 1, crate 2, suitcase 3, toolbox 4, locker 5. Placements and room containers may override their inherited quality with an integer in the same range. A container can generate only items whose quality is less than or equal to its own; the quality filter also applies to explicit loot-table item IDs. Item quality is separate from rarity: after filtering, common weight stays at its configured base, uncommon weight is multiplied by container quality, rare weight by quality squared, epic by quality cubed, and legendary by quality to the fourth power. High-quality containers can still roll lower-quality goods, but low-quality containers cannot roll higher-quality goods. Validation rejects loot pools that cannot supply their minimum count at the selected quality. Inventory details show item and container quality as a level out of 5. This affects generated loot, not manually authored stock, player deposits, scrap rewards, or vendor category selection. Outdoor night refill and morning cleanup stay unchanged.

The supplied `assets/items/items2.png` adds 61 items: food, drinks, household supplies, medical goods, books, clothing, tools, electronics, accessories, and scrap. Items use optional `iconSheet: { path, width, height }` with sheet-local `icon` crops; omission uses the original sheet. Tightly packed icons can use an `iconClip` polygon of normalized `{ x, y }` points to hide neighboring artwork without editing the PNG. Existing artwork and item definitions are preserved. New clothing and useful gear grant carried bonuses within the base six-slot inventory, expanded by carried bags; food, drinks, and medical supplies recover configured vitals. The cashier also stocks Clothing and Book categories.
### Hold-and-release combat timing

Hold F for melee or G for ranged attacks. Each action first plays its two authored preparation sprites once, then holds the second pose while the button stays down. A screen-centered dot and ring appear without opening a modal or pausing the world. The ring contracts in 500 ms, expands in another 500 ms, and loops. Release the same button to play the remaining attack sprites. The timing multiplier is 1x at the largest radius and 2x at the dot, interpolated continuously between them; it multiplies normal difficulty- and skill-adjusted attack damage before final rounding. Ranged eligibility is checked before preparation begins and again on release. Without a carried gun or compatible ammunition, no shooting animation or timing ring starts; the lower-screen notification explains why. Weapon and ammunition Erudition and skill requirements are checked at the same boundary. Ammunition is spent only on release, once per successful shot.

Animation crops live in `hero/outfits/basic/animations/<action>.json.steps`: `fightPrepare` and `shootPrepare` action groups contain the first two original crops; `fight` and `shoot` contain the remaining crops. Preparation does not loop. `hero/index.json.settings.attackTiming` owns half-cycle duration, damage multipliers, ring/dot sizes, line width, and colors. Hero movement and interactions are locked during preparation, while enemies and world updates continue. Damage, death, menus/loading, focus loss, and scene shutdown cancel preparation without dealing damage or consuming ammunition. A canceled hold requires a fresh press to attack again.
Successful attacks also show a floating, fading screen overlay saying `You dealt N damage`. N is the target's actual Health loss, so overkill reports only the Health remaining. Missed attacks show `Miss`. This feedback does not pause gameplay; `hero/index.json.settings.attackTiming.feedbackDurationMs` and `feedbackOffset` control its display duration and starting height.
### Bags and inventory capacity

Bags declare inventorySlots in JSON. Only the bag in the equipment bag slot adds storage to the base six slots; carried spare bags occupy normal slots and add no space. Equipping a bag removes it from inventory. Unequipping returns it to inventory only if every item fits the resulting capacity, including the returned bag. Swapping bags checks the replacement capacity atomically and preserves all items if it cannot fit.

Pickups, buying, take-all, grants, rewards, sales, swaps and saves use the equipped bag capacity. Incoming eligible bags auto-equip when the bag slot is empty and immediately provide capacity; take-all follows container order. Saves derive capacity from inventory.equipment.bag. Overfull saves without an equipped bag are rejected without discarding items.

Nearby Enter prompts share a highlighted selection. Arrow Up/Left selects the previous option; Down/Right selects the next. Enter activates the highlighted object. A/D movement and W/S stairs remain available. Inventory items with unmet skill requirements have a red border.

Thaler is the displayed currency name, carried as the stable `money` item, with `maxStack: 100` and `saleable: false`. This is the exception to consumable-only stacks (other item stacks remain capped at five). Starting money and monetary rewards fill money stacks and require inventory space. Vendor payment consumes carried money; stored money cannot pay. Sale proceeds and quest rewards must fit completely before their transactions commit. Saves mark `currencyInInventory`; legacy wallet balances convert into carried money on load, or loading reports insufficient room without discarding money.

### Perks and addiction

Sniper/Brawler (`attack-charge`, goal 20): damaging melee or ranged hits above 50% charge give Sniper +1; below 50% give Brawler +1. Exactly 50%, misses, zero-damage hits, cancelled preparations and rejected attacks award nothing. The first acquired locks the pair. `chargeDamage.start` and `.full` configure additive timing damage multipliers interpolated across the ring. Sniper subtracts 0.25x at zero charge and adds 0.25x at full charge; Brawler reverses this. Existing perk saves retain progress and acquisition.


Nerd/Punk (`social-style`, goal 10) compete independently of the other perk groups. Receiving advice gives Nerd +1; accepted intimidation choices give Punk +1. Repeated, blocked or cancelled requests give nothing. The first to reach 10 permanently wins. Nerd grants +2 `erudition`, -1 `intimidation`, -1 `martialArts`. Punk grants -1 `erudition`, -1 `persuasion`, +1 `martialArts`, +1 `athletics`. Both progress and acquired perks persist in saves.

Action perks use `ui/perks.json.actionPoints` keys from `domain/character/perks.ts::PERK_ACTIONS` and `skillModifiers` with stable skill IDs. All competing groups are independent, and the first perk in each group to reach its goal permanently wins. Persuasion dialogue choices add +1 Lawful; Intimidation choices add +1 Unlawful, in addition to the existing +1 Lawful for any accepted reply. Mark a dialogue choice with `approach: "persuasion"` or `"intimidation"`; Milos's advice dialogue provides both options. Invalid or blocked choices award nothing.

Hoarder/Scalper (`possessions`, goal 5): successfully recovering an item from scrap gives Hoarder +1 per scrap item spent. Attempts that recover nothing award no points. Looting, deposits, purchases and rejected scrap uses award no Hoarder points. Vendor sales give Scalper +1 per unit alongside their existing Lawful reward. Hoarder grants +2 `scraper`/-2 `barter`; Scalper reverses these.

Bruiser/Skulker (`combat-style`, goal 10): the player's damaging opening attack against an officer or monster while out of combat gives Bruiser +2; detection alone and attacks during an existing fight do not. Escaping a detected officer or monster by leaving detection range gives Skulker +1 per chase. Hiding inside a living officer or monster's detection range gives +1 once per enemy in the current world instance. Repeated frames, dead enemies, paused/dead heroes and context changes award no escape points. Bruiser grants +1 `martialArts`, +1 `weapons`, -1 `athletics`, -1 `stealth`; Skulker reverses these. `scraper` and `stealth` are the game's existing Scraper and Stealth skill IDs.

Lawful and Unlawful use `ui/perks.json` with `actionPoints` and `skillModifiers`, empty `itemIds`, and a goal of 50. Progress tracks are independent; the first to reach 50 permanently locks the alignment group. Lawful grants +2 Persuasion/-2 Intimidation; Unlawful grants the reverse. Successful vendor sales award +2 Lawful per unit (including zero-price sales), accepted dialogue choices +1, and finished quests +10. Successful lockpicking awards +5 Unlawful, damaging police +2, killing police an additional +10, and engaging each officer +1 once during that officer's life in the current world instance. Monsters do not count. Failed/cancelled actions and ordinary storage award nothing. Repeated successful dialogue and repeatable quests can continue earning points. Alignment has no withdrawal or time expiry. Only acquired perks appear in Perks. Alignments show a reputation description and positive/negative skill bonuses; addictions show a short flavor description and their positive/negative effects. Scoring, thresholds, usage instructions and current-status breakdowns stay hidden. Both progress tracks persist in saves.

Edit ui/perks.json to configure competing groups, item IDs, consumption goals, Sanity multipliers, withdrawal fractions, names, descriptions, willpowerOnUse (+1) and willpowerAfterDay (-1). The first perk to reach its goal locks out other perks in its group. Successful inventory uses count one unit; failed uses and crafting/quest removals do not count. With consumeAtMaximum enabled, these substances can also be consumed at full vitals: one item is spent and addiction progress, withdrawal clocks and Willpower still update. Ordinary recovery items are preserved when their recovery is already full. The threshold use grants the perk; subsequent uses receive its bonus. Cigarette packs each count as one use.

Perks opens with P or its HUD button and starts empty; alignments, addictions and buffs appear when acquired. Progress, acquired perks and withdrawal clocks persist in saves; older saves start with no progress. Withdrawal occurs after four elapsed phases without a matching item, including sleep skips, then once per further day. Each charge uses the last consumed item's authored Sanity recovery multiplied by withdrawalFraction, without difficulty, Medicine or perk bonuses. Using a matching item resets the clock. The recovery bonus affects only matching item Sanity recovery; difficulty and Medicine still apply once. Once addicted, matching use sets Willpower to normal +1 without stacking. After four elapsed phases without use it resets to normal -1, without cumulative loss, with a minimum of 1. Derived skills and vital limits update; raising a limit does not heal and falling limits clamp excess points.

Consumable timed effects live in `ui/consumable-buffs.json`: id, name, description, itemIds, exactly one of attribute, vital (health/energy), or fearResistance (true), amount and durationDays. Attribute amounts are nonzero integers from -3 to +3; vital and resistance effects remain positive. Effects last four phases, refresh without stacking, coexist, persist in saves, and appear in Perks and inventory previews. Completed sleep removes all active timed effects before autosaving, including food capacity bonuses and drawbacks; bench rest and cancelled sleep preserve them. Addiction progress and withdrawal remain separate. Attributes clamp at zero; changing vital limits preserves current points and clamps excess without healing.

Alcohol restores at least 15 Energy and grants fear resistance equal to its alcohol percentage: beer and cider 5%, wine 12%, vodka and whiskey 40%, spirits 60%. These timed effects share the optional `group: "alcohol"` field in `ui/consumable-buffs.json`: drinking replaces the previous alcohol resistance rather than stacking, refreshing the four-phase duration until sleep. Alcohol still gives -1 Intelligence and -1 Concentration. Light grey cigarettes restore 16 Sanity and grant +1 Concentration and -1 Physique. Strong red cigarettes double these effects: 32 Sanity, +2 Concentration and -2 Physique. Both use the smoking buff group, so another cigarette replaces the previous bundle for four phases or until sleep. Food restores 6 Health and half its previous Energy (bread 20, canned meat 30, other food 15); hearty tinned/canned food still grants +10 Health capacity and bread +15 Energy capacity.

Medicine, medicine bottle, white/red tablets and steroids use empty recovery objects for effect-only consumption and retain their skill gates. Medicine/tonic grants +2 Physique/-1 Concentration; white tablets +1 Intelligence/-1 Physique; red tablets +1 Physique/-1 Intelligence; steroids +2 Physique/+1 Concentration/-1 Intelligence. Only basic Bandages and Balm tins retain immediate healing. Bandage rolls and antiseptics increase Health capacity; bottled antiseptic and first-aid kits combine Health and Energy capacity. Medical cases combine both capacities with Concentration and its derived skills. Capacity bonuses never restore current vitals. Energy is the existing endurance resource; there is no separate Stamina stat. All these temporary effects expire after four phases or on completed sleep.

Clothing can set `damageResistance` to 1-20 integer percentage points. Eligible carried item types add once per type, alongside active consumable resistance, capped at 100%. This reduces incoming Health damage (including falls), without changing Sanity or Energy costs. Painkillers (red-tablets) grant 30% and steroids 20% for four phases or until sleep; reuse refreshes without stacking. Timed effects use `damageResistance: true` with `amount` from 1-30, mutually exclusive with attribute, vital and fear resistance effects. Inventory, Notes, class previews and Character Combat show resistance.

### Equipment

Non-consumable equipment declares equipmentSlot: ranged, melee, tool, armor, shoes (including socks), accessory (head, belt or hands), amulet, or bag. There is one slot of each kind. Newly acquired items from starting kits, loot, purchases, swaps and rewards automatically equip when their slot is empty and current requirements are met. Occupied slots are preserved. Manual unequip and save restoration do not trigger auto-equip. Equipment grants passive attributes, skills, stealth and resistances only while equipped. Items without equipmentSlot, including books and magazines, grant their passive bonuses while carried, once per item type. Weapons must be equipped to provide weapon damage or shoot. Both melee and ranged weapon damageMultiplier values range from 1 to 1.5; weapons never reduce base attack damage. Enter in standalone inventory equips an item, returning the previous item to inventory atomically; Enter on equipment returns it to inventory if space permits. Containers retain their transfer actions. Equipment persists in optional inventory.equipment; older saves start unequipped.

Bags add storage and stat bonuses only while equipped in the bag slot. Hammer, wrench, screwdriver and pliers grant +1 Scraper while equipped; bags grant +1 Athletics.

All amulets require fearResistance from 5 to 20 integer percentage points, applied only while equipped. Red star badge and Sun amulet give 5%, Horseshoe charm 10%, Medal 15%, and Triquetra pendant 20%.

Alcoholic drinks, including canned beer, have maxStack 3. Water and kvass bottles, oil bottles and flasks remain single items. Medical bottles retain their existing limits. Pistol ammunition stacks to 6; spent shotgun shells are single-slot scrap excluded from useful scrapping rewards; red and grey cigarettes stack to 10. Other consumables remain capped at 5, and money at 100. Loading an older drink stack splits it at the configured limit while preserving quantities and other indexed stacks. If the inventory then exceeds equipped capacity, loading fails without discarding items.


Generic quest saves keep offered values in courierBoard.parameters / npcJobs.parameters and accepted values in QuestProgress.parameters. inventory.deliveryVersion marks the parcel/parameter migration. Legacy route-specific courier, smuggler and find-item IDs collapse into the matching generic template; obsolete apartment tips retire. Parameters, one active run per delivery type, and shared parcel ownership are validated before loading.

Legendary perks are defined in `skills.json.legendary` and activate at 15 effective skill points; falling below the threshold removes their effects. Medicine suppresses negative effects from medicine, alcohol, food and cigarettes, including withdrawal penalties while active. The generic Erudition effect scales eligible positive Book-category carried bonuses by 50%, rounding down; permanent learned bonuses retain their authored +1/+2 values. Equipment, weapon damage, consumables and recovery are unaffected. Legendary Scraper adds 30 percentage points to the ordinary recovery chance, capped at 100%, and recovers a useful non-ammo item from the ordinary reward pool. When that roll fails, it returns 1РІР‚вЂњ3 pistol bullets instead, with equal chances for each quantity. The complete result must fit after consuming the selected scrap; otherwise the attempt preserves the scrap and all inventory items. The base chance retains its 90% cap before the legendary bonus. Bonus chance and fallback quantities are authored in `skills.json.legendary.scrapping`. Dusan always sells lockpick pins. Pistol ammunition is excluded from ordinary vendor stock; Dusan adds six bullets only while Legendary Barter is active, replenished each morning. Ammunition IDs and quantities are authored in `skills.json.legendary.barter.ammunition`. Legendary Barter grants free bus travel while active, including when carried bonuses reach the threshold. Normal travel time and night restrictions still apply. It also adds 3РІР‚вЂњ6 distinct stat items, selected from every sellable stat item in the game, including weapons, equipment, books and consumables. The selection rerolls every morning and persists in saves; reopening the vendor or toggling the perk does not reroll it. Player-sold items survive restocking and perk loss. Daily selection counts are authored in `skills.json.legendary.barter`.

Food, alcohol and medicine timed effects use the groups `food`, `alcohol` and `medicine`. Only one item bundle per category is active: a new item replaces all previous bonuses and penalties in its category while preserving other categories. Multiple effects from the same item stay together. Legacy stacked saves keep the most recently expiring bundle per category.

### Mechanic materials

Irina Kovalenko, the factory worker, offers **Materials under blockade** through the factory-help dialogue. Collect one existing scrap item, then return it for 10 money and work gloves. The dialogue points to nighttime trash bins and their morning cleanup. Hand-in rechecks and consumes one scrap item atomically with the rewards; already carried scrap counts.

### Bartender supplies

Viktor offers **Running low** through his job dialogue. Collect one food item and one alcoholic drink in either order, then hand both over for 10 money and a frying pan. The two inventory objectives share a `parallelGroup`. Stages may declare `requiredItemGroups`, an array of alternative item-ID lists: each group requires one carried unit, without reusing that unit. `removeRequiredItemGroups: true` removes the selected units atomically with rewards at hand-in. Group item IDs must reference existing items. Inventory and dialogue stages may share parallel groups without individual deadlines.

Investigations reuse dialogue nodes through `dialogue.openInvestigation(definition)`, with hero thoughts and action choices, no NPC trust or social rewards. `dialogues/awakening.json` opens after new-game class and difficulty selection; loading a save does not replay it. `daytime.json.initialLocationId` selects the new-game district. Quest location triggers use `{ "kind": "location", "locationId": "center" }`. `daytime.json.initialPhaseTravels` starts the opening night with four of six travel ticks elapsed, so walking from Factory to Center reaches morning. Older saves retain their existing escape-quest objective.

Nadia Morozova offers medical supplies through her greeting Barter option, without a quest prerequisite. She stocks two Bandages, one Antiseptic and one Medicine, plus 1-2 rotating Medical goods. Stock refreshes each morning through the ordinary vendor rules; existing saves initialize her shop without replacing other stored goods.

Patrol type folders use the folder name as their stable type ID. Keep sprite preparation settings, combat, movement and corpse loot in index.json. In animations/idle.json keep idleAnimation, frameRate, repeat and idleSteps; walk.json, run.json, attack.json, death.json and optional shoot.json contain the existing animation objects (key, frames and timing). The loader discovers these files automatically and preserves the runtime shape. Missing required animations, duplicate flat/folder definitions and unrecognized files fail at startup. Validation errors point to the animation file. Flat patrols/types/<id>.json definitions remain supported for compatibility.

Prepared NPC/patrol frames can declare `excludeRegions` rectangles relative to their crop to erase atlas labels touching a pose. These masks require `frameSize`, must stay inside the crop, and apply before backdrop cleanup and scaling. Soldier uses these masks to retain helmets and the raised rifle while removing the supplied sheet's labels; its dark backdrop threshold preserves clothing shadows.

Hero shared settings live in hero/index.json. Each entry in its actions map loads hero/outfits/basic/animations/<action>.json, containing steps and timing (frameRate or durationMs, plus repeat). This includes fightPrepare and shootPrepare. The loader preserves the existing runtime maps and reports animation validation errors against their source file. Missing animation files, duplicate animation keys, unrecognized files and simultaneous flat/folder definitions fail at startup. Flat hero.json remains supported by the content assembler.

Each outfit lives in `hero/outfits/<id>/`: `index.json` owns the sprite asset and
`animations/<action>.json` owns that action's `steps`. Clothing outfit IDs match equipped armor
item IDs. `hero/index.json.basicOutfit` selects `basic`; its index owns the default sprite
asset, and its animation files own both frames and the shared timing (frameRate or durationMs,
plus repeat). Clothing animation files contain only steps and inherit basic timing. The basic
outfit is assembled into the existing default hero fields, not registered as an equippable item.
Missing action files, unknown basic IDs, and duplicate folder/flat definitions fail at startup.
Diagnostics identify each outfit index or action file. Legacy flat hero and outfit definitions
remain supported when not combined with conflicting folder definitions. Clothing changes
preserve the current action, animation progress and hidden pose.

UI content is split by responsibility under `ui/`: `inventory.json` holds `itemSheet` and `itemIconSize`; `location-transition.json` holds fade timing and its label; `selection-keys.json` holds navigation bindings; `rest.json` holds labels and recovery. `menus.json`, `stats.json`, `controls.json`, `perks.json` and `consumable-buffs.json` contain the corresponding arrays in their existing order. All nine sections are required. The content assembler preserves the runtime shape and maps validation errors to the owning section. Missing sections, unknown files and simultaneous flat/folder definitions fail at startup. Flat `ui.json` remains supported by the content assembler.

### NPC facing and door locks

Set `"flipX": true` in `npc/<id>.json` to mirror artwork in the world and notes preview. Omission or `false` preserves the original direction.

`skills.json.doorLocks` maps door IDs (building instance ID or `buildingId:roomId`) to optional `locked` and `rarity` fields. `locked: false` keeps a door open; `true` locks it unless keyed or picked. Omit it for normal day/night rules. `rarity` sets puzzle difficulty through `lockpickingMaxSumByRarity`, defaulting to common. The apartments hall entrance stays open; room locks remain. Container placements use `lockRarity` for difficulty.

Clerk: morning Center shop, afternoon Factory, evening Living District. Caretaker: morning Living District, afternoon Factory, evening Center. Night rooms remain unchanged. Ground-floor chairs in the bar, shop, barracks and apartment hall provide rest.

### Updated item requirements

The current RPG gear balance gives tools, clothing and weapons their own coverage of all eleven skills, while non-reading items still cover all five attributes. Bonuses follow item roles: a knife helps Sneaking and Lockpicking, a crowbar helps Athletics and Scraper, and a medical coat helps Medicine and Education. Every direct skill bonus is capped at +3. Items affecting multiple skills total exactly +4 across those skills, including positive clothing Stealth modifiers; attribute bonuses, resistances, damage and capacity are separate. Multi-skill novels follow the same +4 total. Single-skill items grant up to +3. Bag capacity, prices, artwork and existing item IDs stay unchanged. These rules supersede older one-source attribute and small-bonus descriptions above.

Consumable capacity buffs support Health, Energy and Sanity. White tablets add +15 maximum Sanity alongside their existing attribute effects, for four phases or until sleep. Reuse refreshes the medicine bundle without stacking; other medicine replaces it. Capacity increases do not refill current points. Health and Energy retain their existing food and medical sources.

All authored item requirements have been reduced by 20% from their previous values, rounded down to whole points with a minimum of 1. This is an authored balance change, not a runtime multiplier. Education additionally reduces skill requirements by 5% per effective point, rounded up after reduction and clamped at zero. Education requirements themselves are not discounted. Specialist reading requires its taught skill; Education books and novels require Education. Knowledge, active use and displayed requirements share these checks. Schema limits remain 30 for Education and skill thresholds. Items with specialist skill requirements have no secondary Education requirement or Education alternative; Education still reduces their skill thresholds. Legendary Education grants +1 to every skill while active; its own bonus cannot sustain activation. These rules supersede the older requirement caps and Education perk descriptions above.

The clerkРІР‚в„ўs opening has two independent quests: **Find work** tracks acceptance from the four employers; **First steps** grants room 21 keys and tracks apartment entry, sleep, rest, an actual bus journey, buying/eating food, and buying/using alcohol or cigarettes. Tutorial actions count only after the key handover, can occur in any order, and persist as ordinary parallel stage progress. Purchases count only after a successful vendor transaction. The tutorial rewards five bread and ten light cigarettes. The historical `find-work` apartment stage ID remains as an automatic employer check to preserve existing saved stage indices; it no longer requires visiting an apartment. Older saves that already passed the work introduction start the tutorial after its key handover to avoid issuing duplicate keys.

Completing both quests unlocks **Voices of the town** from the clerk. Every other named NPC has one survey objective. The mechanic and bartender additionally offer honest dissatisfied answers through `skillRequirement`, using Intimidation or Persuasion (labelled Diplomacy), with the authored minimum of six and current/required levels shown. Returning after the survey grants the existing red star amulet. Skill checks are rechecked when choosing a reply.

## Key-only locks and letters

Container placements and room-template containers can set `keyOnly: true`. Keys target containers through `keys[].doorId: "container:<full container ID>"`; carried matching keys open them automatically, and lockpicks cannot bypass them. Door entries in `skills.json.doorLocks` also accept `keyOnly: true`. Use `restock: false` on unique quest safes so their contents stay collected.

An itemРІР‚в„ўs `readingText` opens a text view when used with Enter in inventory. Reading keeps the item for later delivery; this is separate from consumable skill books (`readable`).

### Factory supplies and vehicle searches

After Materials under blockade, Kovalenko offers The missing supplies. Ask the clerk, return to Kovalenko, inspect the factory truck crates, then report that they are empty. Crate inspection requires night or Stealth 8 and does not require opening the vehicle lock. All vehicle furniture supports independent daily searches: night or Stealth 8 to approach; Lockpicking 6 or Athletics 8 to open; Scraper 8 for parts or Barter 8 for valuables. Thresholds and rewards live in skills.json.vehicleSearch. Vehicle contents persist through saves and refresh each morning.

Vendor `stock.offers` lists explicit `{ itemId, chance }` daily offers, with chance in 0..1. Each offer rolls independently once at initialization and each morning; reopening trade and loading saves preserve the current roll. Authored staples remain guaranteed. All sellable non-quest goods have a vendor route, including consumables and equipment; pistol ammunition retains its Legendary Barter restriction. Bartender offers food, drinks and kitchen gear; Dusan tools, weapons, parts and work gear; Nadia medical supplies and clothing; Zofia general merchandise and reading. Overlap is intentional. Cheaper, lower-quality goods have higher authored chances. Daily offers supersede category count rolls when present, and replenish equipment as well as consumables. Player deposits survive morning rolls. Legacy vendors without offers retain their category and finite-equipment behavior.

## Loot tables

Dusan's daily offers include every sellable equipment item outside the melee,
ranged weapon and bag slots, including clothing, tools and amulets. His existing
Barter option also works at home in apartment 12 during his night schedule.
These additions retain their existing vendor offer chances; stock still rotates
each morning. Weapon and ammunition offers are unchanged.

Bags are guaranteed daily offers split between vendors: Zofia sells the briefcase,
Nadia the canvas backpack, and Dusan the duffel bag. Each bag has one ordinary
vendor source. Purchased bags replenish the next morning; existing saved stock
updates on the next morning refresh.

Container pools remain in `loot-tables/*.json`, referenced by placement `lootTable`.
`weights` maps each item ID to a positive relative selection weight (default 1).
These weights multiply the existing rarity and container-quality weights; they
are not independent drop probabilities. Item-count limits and pool filters still apply.
All extracted weights start at 1 to preserve the existing balance.

Vendor stock lives in `loot-tables/vendors/<id>.json`. Dialogue barter entries
reference it with `stockTable: "<id>"`. Each `offers` entry has an `itemId` and
`chance` from 0 to 1, rolled independently at the existing stock refresh time.
The table also owns categories, item-count limits and quantity limits. Guaranteed
barter `items` remain on the vendor definition.

Corpse drops live in `loot-tables/corpses/<id>.json`. Patrol definitions reference
an array with `corpseLootTable: "<id>"`. Each entry has `itemId`, `min`, `max`, and
an optional `chance` from 0 to 1 (omitting chance guarantees the drop).

Monster tables independently roll six rare rewards: leather boots, brass knuckles,
first-aid kit, barbed bat, medical coat and pocket watch. Each has a 4% chance for
Octopus, 8% for Fly and 15% for Titan. Legendary service pistols and Triquetra
pendants each roll at 0.5%, 1.5% and 3% respectively. Each successful roll drops one
item. A corpse can contain none, one, or several rewards. Titan's strange key
remains guaranteed. Rolls happen once when the corpse is created; reopening it
never rerolls the contents. All item pools and probabilities live in the monster's
corpse loot table.

Legendary Diplomacy pacifies unprovoked human patrols, including Militia and
Soldiers at night. Attacking them still permits retaliation. Monsters ignore this
perk and retain their normal detection, pursuit and attacks.

Discovery expands these references before the existing runtime schemas and item
reference checks run. Missing references and inline/table conflicts are errors.
Inline stock and corpse drops remain supported for tooling and older fixtures.

Item files are grouped by their existing category in lowercase folders (for example,
`medical`, `weapon`, and `book`). Discovery searches item subfolders recursively.
Filenames must still match item IDs; moving a file never changes its ID or balance.
Item ordering remains alphabetical by filename, independent of folder names.
After **Running low**, Viktor offers **Nothing to serve**: ask Zofia, ask Pavel, then return for money and an enamel mug. Pavel's optional Barter 8 reply explains military supply priority; the normal route needs no skill check. **Everything under control** follows: take the protected, readable clerk-report from center-post at night, show Viktor, return it to center-post at night, then collect money and a barbed bat. Cash uses the existing effective-skill reward formula. Protected deliveryItemId quests can prepare a fixed quest item without joining the rotating courier/smuggler jobs.

NPC dialogues can define `openingLines`, a nonempty array of opening phrases.
Each resident has three character-specific lines. Opening a conversation cycles
through them in authored order, independently for each NPC within the session.
Returning to the root keeps that conversation's selected line and original choices.
Without this field the root text stays unchanged; investigations use their authored text.

Each resident's `ask-about` root topic contains five placeholder questions. Edit
`nodes.ask-about.choices[].text` for questions and `nodes.ask-about-answer-N.text`
for answers in that resident's dialogue JSON. Keep IDs and links stable.
`trustRequirement` is an optional integer from 1 to 5. `skillRequirement` accepts
any existing skill ID. Both requirements appear with current/required values;
locked questions remain visible and selection rechecks both before any effects.
The five authored levels are Trust 1/2/3/4/5 and skill 4/6/8/10/12. Answers return
to the question menu or the conversation root. These topics do not grant trust.

**Well Trained** tracks gun and melee defeats and escaping a chase into a hideout in parallel after asking Pavel for work. Completion awards a permanent perk: +1 Weapons, +1 Martial Arts, +1 Sneaking. Only killing blows count; hiding without a chase does not.

Postman work uses `morningStart: true` on a repeatable quest with a postbox loot
stage and `deliveryItemId`. A letter is prepared at startup and each new morning
when no delivery is active. The quest enters the journal only after a successful
letter pickup; opening the postbox or a failed transfer does not start it. Waiting
letters keep their recipient across mornings and reloads. The daily ledger prevents
replacement letters after completion until the next morning. Routes and progress
persist; unfinished letters
have no deadline. Recipient choices use the ordinary quest dialogue gates.

Inventory quest stages may set `collectedFrom` to a finite, non-restocking container
that initially holds their required items. An unlocked source with none of those goods
remaining credits earlier collection, including equipped, stored, sold or consumed loot.
This never replenishes the source or bypasses reward capacity checks. The illegal weapon
job uses the apartment 11 safe so looting it before acceptance does not block progress.

Sneaking reduces detection range by 1/60 of the base radius per effective point
(about 1.67%, reduced from 5%). Fifteen points reduce range by 25%; thirty by 50%.
The rate lives in `skills.json.stealth`. Legendary Diplomacy pacification is supplied
only to human patrols; monsters retain normal detection and hostility.

`emptyInteriorSpawn.buildings` overrides the chance and equally likely monster `types`
for specific building placements. Factory main and Center shop each have a 30% total
nighttime chance of one Octopus or Fly (15% each). Other interiors retain their default
chance. Occupied interiors, the hero location and reserved rooms remain excluded.

Story investigation points and disappearance notices display a pulsing, glowing
exclamation mark in their visible world context, before entering reading range.
`settings.json.interaction.storyGlow` owns its label, color, glow and timing. Ordinary
props, containers, NPCs and doors receive no marker. Up/Down arrows switch between
nearby Enter actions using the current frame's available prompts.

Pavel's official-exit offer opens its briefing immediately. Asking for authorization
leads directly into the bargain branch; Back and the root topic can resume it. The
Barter acceptance check supplies authored `requirementFailureText`, displayed without
advancing a stage or spending goods when a live skill/trust requirement fails. An
accepted bargain still requires the Center checkpoint handoff (one free permit slot)
and then the departure checkpoint; Pavel never grants an instant exit.

NPC `portraitIndex` optionally selects a cell (0-7, left to right, top row first) from
`assets/characters/npc/faces.png`. Dialogue and Notes / People share these portraits.
`portraitBackgroundThreshold` clears dark pixels connected to a portrait's outer edge
at display time, leaving the parchment frame and enclosed facial details intact.

Quest decisions with two outcomes require skill level 14 for their checked reply.
Three-outcome decisions require levels 16 and 12; the remaining reply is free.
Well Trained awards its hiding objective after a successful hide behind any hideout object,
without requiring a pursuit. Ending slides cycle through story backgrounds 1, 2 and 3.

Five readable Document items contain town notes. The Apartment Notice is in apartment 31,
below apartment 41. The Nurse's Unsent Letter is in living-district-cover-box, and the
Shopkeeper's Hidden List is in center-locker-box near the shop. Both crates have fixed
contents and never restock. The Factory Night Shift Log is in a locked toolbox beside
the factory entrance. The Soldier's Pocket Note has an independent 5% soldier corpse
drop chance. These notes are excluded from random loot and vendor sales.
