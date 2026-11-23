# Architecture

| Folder | Responsibility |
| --- | --- |
| app/bootstrap | Validate content, construct session services, compose and destroy Phaser |
| app/contracts | Typed commands and immutable snapshots shared by UI and game |
| app/services | Persistent gameplay systems grouped by responsibility (see below) |
| app/content | Framework-free configuration schemas and cross-reference validation |
| game | Phaser scenes, world composition, input, rendering and entity managers |
| domain | Pure dialogue, inventory, navigation and platform movement rules |
| ui | React DOM menus, HUD and reusable controls |
| content | Authored JSON and typed adapters; see src/content/README.md |
| platform | Browser/native API adapters, dialog lifecycle and DOM shortcuts |
| public/assets | Runtime images and other binary assets |
| tests | Node behavior and configuration tests |

Domain has no Phaser, React, browser or native dependencies. Game and UI consume app contracts; neither imports the other's implementation. Authored values belong in JSON, not in runtime classes. CSS remains responsible for DOM layout and appearance.

## Gameplay systems

The Phaser runtime stays in `src/game`: scenes own world lifecycles, entities own
actor presentation, and input, physics, combat and rendering have dedicated folders.
Engine-independent mechanics stay in `src/domain`. Session systems live longer than
a scene and are grouped under `src/app/services`:

| Folder | Responsibility |
| --- | --- |
| `core` | Observable stores and event channels |
| `inventory` | Inventory ownership, transactions, equipment, loot and persistence |
| `character` | Vitals, perks and time-driven status costs |
| `world` | Daytime, travel, resting and vehicle searches |
| `dialogue` | Conversations, advice and NPC interactions |
| `quests` | Quest progression and daily offers |
| `puzzles` | Lockpicking interactions |
| `progression` | Statistics and discovered notes |
| `audio` | Session audio orchestration |
| `ui` | HUD menu and message state |
| `session` | Options, loading transitions and window/gameplay coordination |

These folders organize existing responsibilities; they do not create independent
state owners or a service locator. `app/bootstrap/createSession.ts` constructs and
connects them through typed capabilities. UI and game callers continue to use
`app/contracts`, while platform adapters own storage and browser integration.

Content remains in `src/content`: items use category folders, locations own their
placements, and container/vendor/corpse loot tables remain separately authored.
Runtime images stay in `public/assets`; imported audio stays in `src/sounds`.
Tests retain their behavior-based module folders under `tests`.

Flow: App -> createSession -> validateContent -> session services -> createGame -> GameplayScene -> LocationWorld. Bootstrap owns service construction. A scene owns its world objects and releases its world reference on shutdown; travel recreates the world while keeping session inventory and container contents.

GameplayScene manages Phaser lifecycle and travel restarts. LocationWorld composes building/container managers, the player, NPC roster and bus stop. A framework-free content resolver selects scheduled NPCs for the arrival phase and district. All NPC assets preload for time changes without scene restarts. Schedule positions can target streets, building floors or bound rooms; creation converts local interior coordinates and fits actors below ceilings. DialogueNpc matches the active building/room context for visibility. Managers own geometry, nearest-object interaction and interior visibility. Entities consume validated data. ConfiguredBuilding and DialogueNpc replace per-asset subclasses, so another definition does not require a registry edit.

Building owns a RoomManager for optional room-door bindings. Room instances render individual crops above a building shade. RoomManager preserves corridor position/scale, selects doors by floor, and exposes the active room's movement bounds and platforms. A room visit suppresses corridor props and stair/building-exit interaction until returning. Room definitions live in content/rooms; building definitions bind their IDs to local door coordinates.

PatrolManager resolves phase-dependent ambient populations and owns independent Patrol NPC instances. Patrol extends the NPC sprite/animation base; the pure domain Wanderer controls walking, pauses and edge turns. The manager pauses officers during menus and hides them indoors. Type and per-district population settings are separate JSON files under content/patrols.

InteractiveObject owns shared proximity, visibility, prompt and interaction behavior for NPCs, containers, taskboards and bus stops. An optional interaction offset lets wall-mounted props remain reachable from their floor. PlacedObjectManager shares nearest-object selection and building visibility for containers and taskboards. Taskboards open the existing HUD menu through its contract. Rendering helpers prepare cutouts, optional silhouettes and normalized sprite views. Hero-specific matte/anchor processing preserves character details and foot alignment.

App services extend ObservableStore, providing stable subscriptions and snapshots to React's useSyncExternalStore. Services contain no framework objects. GameServices is injected at the composition root. A shared modal-state query pauses gameplay for travel, dialogue, inventory and HUD panels.

RestService owns seat/bed confirmations through an app contract; React reuses Modal and SelectionList. DayTimeService advances a phase for resting or atomically selects next morning for sleeping. LocationWorld refreshes tint and scheduled actors when the phase changes, preserving geometry, room state and hero position. FurnitureManager combines location props with room-local definitions and owns visibility and interaction dispatch. Hero owns cover pose/layer state, preventing movement until revealed. All relevant sprites are preloaded so time changes do not require asynchronous scene restarts.

DayTimeService owns the session day and four-phase cycle through an app contract. TravelService counts bus trips against the configured travelsPerPhase threshold (two by default); walking trips cost a whole phase and preserve partial bus progress. The travel contract carries the mode. BoundaryTravel opens the existing menu at outdoor world bounds and rearms after moving away, allowing cancellation without reopening every frame. Time updates before arrival. React observes the same snapshot for the HUD, and each LocationWorld reads it when applying its configured outdoor tint. Inside buildings, the daytime tint moves behind the occupied interior so outdoor scenery keeps its current lighting without extra dimming. Lighting and icon crops are authored in daytime.json.

Inventory rules seed explicit items and optional random tables once per session, then transfer stacks without mutating prior snapshots. Pure vertical motion accepts standable surfaces from containers, props and building views; NPCs never supply surfaces. Movement accounts for ceiling limits, descending landings and falling from edges.

Configuration is validated before game construction. Validation checks shapes, positive scales, IDs, references, floors, dialogue links, loot pools and icon crops. Vite discovers individual JSON definitions; the framework-free content assembler combines them and maps validation errors back to authored files. Locations own building, NPC and container placements. Container types and loot tables are reusable definitions. Browser-specific lifecycle and keyboard hooks stay in platform.
