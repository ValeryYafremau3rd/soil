# Project rules

Build a small, playable web 2D platformer/shooter/RPG. Use installed Phaser, React, strict TypeScript, Vite, and Node 22.12+ tests. Keep future Tauri/Capacitor portability; do not add wrappers, dependencies, frameworks, multiplayer, backend, networking, or monetization without a request.

## Boundaries
- `src/game`: Phaser world, physics, camera, entities, input adapters.
- `src/domain`: engine-independent rules; extend existing modules, not a parallel features tree.
- `src/ui`: React overlays; call typed service actions, never mutate scenes.
- `src/app/services` / `contracts`: observable state, actions, cross-layer interfaces; `bootstrap/createSession.ts` composes them.
- Group services by gameplay responsibility: `inventory`, `character`, `world`, `dialogue`, `quests`, `puzzles`, `progression`, `audio`, `ui`, and `session`; shared store/event primitives live in `core`. Keep implementations behind existing contracts and preserve one owner per state snapshot.
- `src/content`: JSON data; `src/platform`: storage/platform adapters; `public/assets`: existing assets.

Keep rules/puzzle completion separate from presentation, input mapping separate from actions, and storage behind adapters. Prefer simple changes; no speculative abstractions or empty folders. The developer owns architecture, contracts, and merges. Preserve boundaries unless the request requires changes.

## Code structure and refactoring
- Apply SOLID through clear responsibilities and composition. Keep state ownership in services, rules in domain functions, and rendering/input in their existing layers. Inject narrow typed capabilities into collaborators; do not introduce a service locator or expose mutable internals to UI/game callers.
- Aim for roughly 100 lines per source file across all of `src`, not just newly created files. For long modules, create a responsibility-named folder and split related code into a few cohesive files. Preserve existing public imports when compatibility requires it; remove obsolete forwarding layers when safe. Do not compress code or create trivial files just to meet the target.
- Try to keep every function below 25 lines. Split larger functions into meaningful, named steps and call those helpers from the main function. Count readable physical lines, not compressed statements; keep signatures and documentation readable too. Allow a longer tightly coupled algorithm only when splitting would obscure its invariants.
- Keep composition roots such as `bootstrap/createSession.ts` focused on calling setup functions in a clear order. Extract validation, service wiring, derived-state calculations and lifecycle setup into cohesive helpers. Preserve initialization order, lazy callbacks, subscriptions, state ownership and save/restore behavior.
- Reuse functions for repeated rules and components for repeated presentation. Use classes when an object owns state, resources or a lifecycle; do not add inheritance, interfaces or generic frameworks without a concrete need.
- Name files and exported symbols after their actual responsibility. Match class filenames to class names; use descriptive verbs for operations and predicate names for boolean checks. Distinguish gameplay scenes, service state owners, controllers, update loops, content assembly and file expansion. Update imports, tests and documentation together when renaming. Treat authored IDs, asset paths and persisted keys as compatibility-sensitive identifiers rather than cosmetic names.
- Remove confirmed unused code, imports, parameters and obsolete forwarding layers. Check repository-wide references, tests, content discovery and event/callback entry points before deleting an export. Preserve user edits and compatibility migrations.
- Put configurable gameplay and presentation options in the owning JSON files, including tunable numbers, choices, timing and probabilities. Keep structural invariants, algorithmic offsets, unit conversions and historical migration limits as named code constants where appropriate. Update schemas, types, reference validation and consumers together, and preserve existing values during refactors.
- Apply the formatting and documentation rules below throughout `src`. A folder-wide request covers the whole requested folder; do not treat a small sample or a formatting-only pass as completion of a broader refactor.
- For broad refactors, record a test baseline and compare failing test names afterward. Do not change balance, expected behavior or authored data to hide existing failures.

## Readability and JSDoc
- Aim for lines of at most 100 characters. Wrap long signatures, calls, conditions, type declarations and expressions at logical boundaries. Preserve authored text and string/template literal contents when wrapping would change behavior.
- Use blank lines between logical steps, declarations and documentation blocks. Keep related statements together; avoid blank lines between every parameter or property and immediately inside delimiters. Use normal indentation and one statement per line; never compress code to satisfy size targets.
- Add descriptive JSDoc to every function, class and interface, including methods, constructors, accessors and assigned arrow functions. Document inline callbacks when they implement meaningful behavior; keep short predicates readable at their call site.
- Function JSDoc must explain purpose, input parameter meanings and types with `@param {Type} name`, and output meaning and type with `@returns {Type}` where applicable. Describe optional/default parameters and relevant units, side effects or failure conditions. Constructors describe initialization and dependencies; classes describe responsibility, owned state/resources and lifecycle; interfaces describe the contract and intended use.
- Write comments that explain behavior and intent, not just restate names or types. Avoid boilerplate such as "Perform X" or "the result described by the signature." Keep TypeScript signatures authoritative, use valid JSDoc types, preserve useful existing comments, and update documentation when code moves or changes.
- Add concise implementation comments for non-obvious invariants, ownership and compatibility decisions. Avoid narrating routine statements. Audit documentation coverage when the request applies to an entire folder.

## Workflow
Read relevant files, briefly state approach and files, implement, verify, report changes/checks/issues. Proceed without confirmation; ask one focused question only when blocked. Keep scope narrow; preserve user edits/assets. No commits, branches, merges, pushes, unrelated refactors, or fabricated assets. Respect tool sandbox approvals.

Use `rg`, bounded reads, and batched independent calls; avoid whole-subsystem dumps. Preserve UTF-8 (apply_patch or explicit UTF-8 PowerShell/.NET). Start background helpers hidden; reuse running Vite/CDP helpers where practical. Inspect temporary scripts before reuse.

## Navigation and content
Read `src/content/README.md` only for affected authoring rules and `tests/README.md` for verification/module ownership. `catalogue.ts` / `app/content/assembleContent.ts` discover JSON; examples are excluded. New registry files normally need no registration.

For new JSON fields update types, `configSchemas.ts`, reference validation when relevant, and consumers. Classes use `domain/skills/character.ts::validateClasses`. Keep balance in JSON and difficulty formulas in `domain/character/difficulty.ts`. Inspect the owning world manager before modifying `LocationWorld.ts`. Inspect PNGs before choosing crop coordinates; use existing texture preparation and content-defined frames/anchors/timing. Do not regenerate assets unless asked.

`app/content/configSchemas.ts` composes subsystem schemas from `app/content/schemas`; cross-reference checks live in `app/content/validation`. `app/persistence/validateSave.ts` coordinates shape checks, compatibility migrations and subsystem validators in order. Keep these entry points small and preserve their validation/error ordering. Hero, patrol and UI JSON folders assemble into existing runtime shapes; services that run under Node must not depend on Vite-only discovery.

- Organize item definitions in `src/content/items/<category>/<item-id>.json`, using lowercase existing item categories. Discover item folders recursively. Preserve IDs, filename/ID validation, item data and filename-based runtime ordering when moving files; update source diagnostics, direct-path tests and authoring documentation.
- Keep container, vendor and corpse loot in separate JSON tables under `src/content/loot-tables/`. Container pools use the root table files; vendor tables live in `vendors/` and corpse tables in `corpses/`. Reference tables from their owning definitions rather than embedding random item lists there.
- Loot tables own item lists and their selection weights or drop chances, plus applicable quantity/count limits. Preserve the distinction between container relative weights and independent vendor/corpse probabilities. Retain guaranteed contents and quest items in their owning definitions when appropriate. Validate table references, item IDs, probability/weight ranges and conflicting inline definitions; preserve refresh timing, deposits and saved contents.

## Preserve behavior
- Class -> Difficulty -> gameplay; coordinate ordinary windows through `coordinateWindows.ts` and toggle hotkeys.
- Six base inventory slots plus carried bags; item stack limits, indexed selections, partial stacks, cross-grid arrows, and Enter actions must remain correct.
- InventoryService owns money/prices. Buy at configured unit price, sell at floor(price/2), including zero. Barter uses `getPrice` for UI and transactions. Check affordability and capacity atomically; ordinary storage is free. Preserve deposits on refresh.
- Travel/rest/sleep advance phases. Difficulty applies recovery once; rest/sleep exempt Energy drain, not Sanity time costs. Preserve morning refreshes, bus fare/night restrictions (also in services), and walking at night.
- Dynamic skill effects include eligible carried bonuses. Medicine applies once in `recover`; `getRecovery` previews. Attribute vitals apply after difficulty (+5 per mapped point). Equipment cap updates preserve points, clamp excess, and never heal.
- Hidden heroes evade outdoor night detection. Detected heroes cannot hide inside any living patrol's range. Patrol damage lands at attack animation completion.

## Verification
Start with owning tests and directly affected integrations: `npm test -- inventory quests`, or one file (`inventory/trade`). New `tests/<module>/*.test.mjs` files auto-discover; use `tests/helpers/content.mjs` for real data. Runtime TS imports need `.ts`; avoid parameter properties under Node stripping. Cover relevant failures, repeated/cancelled actions, capacity/payment, hidden/dead targets, and time rollover.

For TS: run `npm run check` and scoped `npm run lint:files -- <changed files>`. Use `npm run build` instead of check for bootstrap, bundler, discovery, asset loading, or release changes; build already typechecks. JSON: content + owning behavior tests. UI/input/animation: focused browser smoke check; CSS needs visual verification. Docs: read back.

Full suite only for runner/layout changes, broad shared-contract/infrastructure impact, or integration checkpoints. Broaden for new failures/risks; do not repeat unrelated successful checks. Report exact checks and limits. Existing balance-expectation failures exist: recheck when their module runs, distinguish regressions, and never alter authored balance merely to satisfy stale tests.
