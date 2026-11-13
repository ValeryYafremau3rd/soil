# Project rules

Build a small, playable web 2D platformer/shooter/RPG. Use installed Phaser, React, strict TypeScript, Vite, and Node 22.12+ tests. Keep future Tauri/Capacitor portability; do not add wrappers, dependencies, frameworks, multiplayer, backend, networking, or monetization without a request.

## Boundaries
- `src/game`: Phaser world, physics, camera, entities, input adapters.
- `src/domain`: engine-independent rules; extend existing modules, not a parallel features tree.
- `src/ui`: React overlays; call typed service actions, never mutate scenes.
- `src/app/services` / `contracts`: observable state, actions, cross-layer interfaces; `bootstrap/createSession.ts` composes them.
- `src/content`: JSON data; `src/platform`: storage/platform adapters; `public/assets`: existing assets.

Keep rules/puzzle completion separate from presentation, input mapping separate from actions, and storage behind adapters. Prefer simple changes; no speculative abstractions or empty folders. The developer owns architecture, contracts, and merges. Preserve boundaries unless the request requires changes.

## Code structure and refactoring
- Apply SOLID through clear responsibilities and composition. Keep state ownership in services, rules in domain functions, and rendering/input in their existing layers. Inject narrow typed capabilities into collaborators; do not introduce a service locator or expose mutable internals to UI/game callers.
- Aim for roughly 100 lines per source file. Extract cohesive responsibilities when a file grows; allow longer composition roots, contracts or tightly coupled algorithms when splitting would add indirection. Do not compress statements or create trivial forwarding files to meet the target.
- Reuse functions for repeated rules and components for repeated presentation. Use classes when an object owns state, resources or a lifecycle; do not add inheritance, interfaces or generic frameworks without a concrete need.
- Remove confirmed unused code, imports, parameters and obsolete forwarding layers. Check repository-wide references, tests, content discovery and event/callback entry points before deleting an export. Preserve user edits and compatibility migrations.
- Put tunable gameplay and presentation numbers in the owning JSON configuration. Keep structural invariants, algorithmic offsets, unit conversions and historical migration limits as named code constants where appropriate. Update schemas, types and consumers together, and preserve existing values during refactors.
- Add concise comments explaining non-obvious intent, invariants, ownership and compatibility decisions. Avoid comments that repeat a function name or narrate routine statements. Keep comments accurate when moving code.
- For broad refactors, record a test baseline and compare failing test names afterward. Do not change balance, expected behavior or authored data to hide existing failures.

## Workflow
Read relevant files, briefly state approach and files, implement, verify, report changes/checks/issues. Proceed without confirmation; ask one focused question only when blocked. Keep scope narrow; preserve user edits/assets. No commits, branches, merges, pushes, unrelated refactors, or fabricated assets. Respect tool sandbox approvals.

Use `rg`, bounded reads, and batched independent calls; avoid whole-subsystem dumps. Preserve UTF-8 (apply_patch or explicit UTF-8 PowerShell/.NET). Start background helpers hidden; reuse running Vite/CDP helpers where practical. Inspect temporary scripts before reuse.

## Navigation and content
Read `src/content/README.md` only for affected authoring rules and `tests/README.md` for verification/module ownership. `catalogue.ts` / `app/content/assembleContent.ts` discover JSON; examples are excluded. New registry files normally need no registration.

For new JSON fields update types, `configSchemas.ts`, reference validation when relevant, and consumers. Classes use `domain/skills/character.ts::validateClasses`. Keep balance in JSON and difficulty formulas in `domain/character/difficulty.ts`. Inspect the owning world manager before modifying `LocationWorld.ts`. Inspect PNGs before choosing crop coordinates; use existing texture preparation and content-defined frames/anchors/timing. Do not regenerate assets unless asked.

`app/content/configSchemas.ts` composes subsystem schemas from `app/content/schemas`; cross-reference checks live in `app/content/validation`. `app/persistence/validateSave.ts` coordinates shape checks, compatibility migrations and subsystem validators in order. Keep these entry points small and preserve their validation/error ordering. Hero, patrol and UI JSON folders assemble into existing runtime shapes; services that run under Node must not depend on Vite-only discovery.

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
