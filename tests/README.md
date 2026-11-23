# Focused verification

Use Node 22.12 or newer. Tests use Node's built-in runner and TypeScript stripping; no new framework or dependencies are required. Game source stays in its existing domain, service, UI and Phaser modules.

## Commands

- `npm run test:inventory`: run one subsystem.
- `npm test -- inventory quests`: combine affected modules without duplicate files.
- `npm test -- persistence/save`: run a single test file (the extension is optional).
- `npm test -- inventory/trade name=afford`: filter test names within the selected file.
- `npm run test:list`: list all modules and automatically discovered test files.
- `npm run test:list -- quests`: preview a focused selection without running it.
- `npm test` or `npm run test:all`: run the entire suite at a broad integration/release checkpoint.

Selectors also accept full paths such as `tests/inventory/trade.test.mjs`. Unknown modules and ambiguous filenames fail with an error; the runner never silently falls back to running everything. New `*.test.mjs` files inside module folders are discovered automatically. `scripts/test-selection.mjs` handles discovery/selection; `scripts/test.mjs` invokes the existing Node test runner and preserves its exit code.

Use the shown `name=...` form and `test:list` alias through npm on Windows: PowerShell/npm can swallow extra `--flags` before they reach the test script. Direct Node invocation also supports `--name=...` and `--list`.

## Modules

Each module has a `npm run test:<module>` shortcut. Start with the owning module, then add only the integration modules affected by the change.

| Module | Owns | Add when relevant |
| --- | --- | --- |
| `character` | Classes, difficulty, attributes/vitals, skill effects | `inventory` for carried bonuses; `combat` for damage scaling; `persistence` for saved character state |
| `inventory` | Stacks, transfers, prices, vendors, item effects, inventory selection | `quests` for rewards/removal; `lockpicking` for tool consumption; `combat` for ammunition; `persistence` for stored inventory |
| `travel` | Bus/walking routes, fares, phases, morning refresh | `world` for locations/NPC placement; `persistence` for saved time/travel |
| `world` | Buildings, rooms, furniture, boards, room containers, NPC schedules | `travel` for edge behavior; `lockpicking` for locked interactions; `quests` for boards |
| `movement` | Platforms, falling, fall/time costs | `world` for surfaces; `character` for difficulty scaling |
| `combat` | Patrol AI/detection/combat and shooting | `inventory` for ammunition; `character` for skill/difficulty modifiers |
| `quests` | Stages, requirements, rewards, shared messages, full-inventory feedback | `inventory` for transactional changes; `ui` for dialogue/window behavior; `persistence` for progress format |
| `lockpicking` | Puzzles, locks, lockpick consumption | `inventory` for tools; `world` for doors/containers; `persistence` for saved locks |
| `persistence` | Save validation, save/load/restart, restoring session state | Owning modules for changed saved state |
| `content` | Strict schemas, references, authored data, file discovery | The module consuming the changed definition |
| `ui` | Dialogue, menu selection, stores and window coordination | Owning behavior module plus a focused browser check |
| `rendering` | Sprite crops, frame validation and cutouts | `world` for sprite placement plus a focused browser check |
| `tooling` | Test discovery and module selection | Full suite when changing test layout or runner behavior |

Examples: a vendor price fix normally needs `inventory`; a quest reward transaction needs `quests inventory`; a save-format change needs `persistence` and the affected state modules. Changing a shared contract used across the session can justify the full suite. Editing a single unrelated subsystem does not.

## Choose other checks by scope

- TypeScript changes: `npm run check` once, plus `npm run lint:files -- src/path/Changed.ts src/path/Changed.tsx`.
- Test-runner JavaScript: lint the changed scripts and run `tooling`; runner/layout changes also require one full-suite comparison.
- Pure authored JSON/balance changes: `content` plus the consuming module; avoid an unrelated production bundle.
- UI/input changes: typecheck and lint changed TS/TSX files; use only the relevant browser scenario. CSS-only layout changes need visual/browser verification.
- App/bootstrap, asset loading, Vite/dependency or content-discovery integration: `npm run build` in place of `npm run check`.
- Documentation-only: read back the changed text.

`npm run lint` remains the full lint command. `npm run build` includes TypeScript checking, so do not also run `check`. Broaden or repeat successful checks only for a new change, failure or unresolved concern.

## Tests and fixtures

Put new tests in their owning module folder. Source imports from these files start with `../../src/`; runtime TypeScript imports must include `.ts`. Use `../helpers/content.mjs` to load real authored content, and `../../public/` for asset reads. Keep engine-independent rules and service actions testable without Phaser rendering. Add boundary tests for meaningful behavior, not tests that mirror implementation details.

Verified baseline after this reorganization (2026-11-10): 238 tests, 234 passed, 4 failed. All 235 original tests were retained, and three tooling tests were added. The failures are one authored class-skill expectation in `character/classes.test.mjs` and three fall-damage expectations in `movement/fall-time-costs.test.mjs`. Recheck when running those modules; do not change balance to hide failures. A focused run that excludes these modules must not imply that the full suite passed.

See `src/content/README.md` for authoring conventions.

## Browser smoke checks

Run only the scenarios affected by the current change. Existing Chrome/CDP helpers in node_modules/.tmp are temporary; inspect before reuse.

- Travel through Living District, Factory and Center. Verify the correct background,
  bus-stop arrival, NPCs and buildings. Enter and leave both Center buildings.
- Enter buildings, climb applicable stairs and test wall/ceiling boundaries. Outdoor
  NPCs and prompts hide inside; scenery dims while the active interior stays bright.
- Approach an NPC and press Enter. Verify hello -> hi -> goodbye, W/S selection,
  closing with Escape and resetting to hello when reopening.
- Travel through the four daytime phases and verify NPC districts/positions match
  their JSON schedules. Scheduled arrivals must load the correct art even in a
  district with no static NPC placement. Dialogue and interior hiding still work.
- Inspect nearby loot previews. Pick up individual items and Take all; check item
  icons/quantities via I and the Inventory button. Travel away and back: collected
  items persist and empty containers stay empty. Indoor containers appear only in
  their attached building, on the configured floor.
- Confirm all modal types pause movement and controls resume after closing.
- Confirm rest/cancel at street benches and room chairs. Sleep in a room bed:
  next morning and day number update, room/position remain, and outdoor actors
  reflect the new phase. Verify outdoor cover uses jump frame 0 behind the prop;
  Enter again restores the front layer/idle, and movement is blocked while hidden.
- Verify patrol populations by phase: Center and Living District always 2 Soldiers + 1 Militia; Factory daytime 2 Soldiers + 1 Militia,
  nighttime Titan plus a 10% roll for 2 Soldiers + 1 Militia. Center/Living District each roll 50% for 3 Octopuses and 50% for 1 Fly at night. Watch walk/idle transitions and boundary turns;
  officers pause in menus, hide indoors and never provide jump surfaces.
- Approach street taskboards and press Enter to list available quests. Accept with Enter, use up/down for quests and left/right for journal tabs. Enter
  each building: street boards hide and its wall board becomes visible. Verify
  Enter works from the floor below the raised artwork and Escape resumes play.
- Jump onto a container or configured table, jump again from that top, then walk
  off and fall back to the floor. NPCs must never support the hero. Ceilings still
  limit jumps, and idle frames must keep feet aligned.
- Resize and reload; check the console and ensure React StrictMode does not leave
  duplicate canvases or input listeners.
