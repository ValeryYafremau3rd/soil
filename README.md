# My Game

A browser-based 2D platformer/shooter/RPG built with Phaser, React, TypeScript and Vite.

## Run

Use Node.js 22.12+ or a supported newer LTS, and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. To test from a phone on the same LAN, run
`npm run dev -- --host 0.0.0.0` and use the computer's LAN address and printed port.

```sh
npm run check
npm run lint
npm run build
npm run preview
```

Production output goes to dist/. The canvas fits a 960 x 540 logical viewport.
This runs on desktop and mobile browsers. Native desktop installers and mobile app
packages need wrappers and platform testing later. No native tooling is configured.

## GitHub Pages

The repository root contains this game's package.json. The Pages workflow builds
and publishes dist/ on pushes to main, or when run manually from GitHub Actions.
Vite uses /soil/ as its base path for the soil repository.

In the repository's Settings → Pages, select GitHub Actions as the deployment source.
After the changes are committed and pushed, check the Deploy SOIL to GitHub Pages
workflow in the Actions tab. The published URL is
https://ValeryYafremau3rd.github.io/soil/.

Run npm run build and npm run preview to preview the production build locally;
open the printed URL under /soil/.

## Game versions and saves

The game version is defined in `src/app/version.ts` and displayed in the bottom-right
corner. Use `0.compatibility.0.update`, starting at `0.2.0.1`. The first and third
numbers stay zero; the fourth is always at least 1. Compatible updates increment
the fourth number (`0.2.0.1` -> `0.2.0.2`). When a change breaks save compatibility,
increment the second number and reset the fourth to 1 (`0.2.0.2` -> `0.3.0.1`).

New saves include `gameVersion`. Loading requires the same second number, alongside
the existing schema and content validation. Older saves without `gameVersion` belong
to the initial `0.2.0.1` family and still undergo validation. Rejected loads preserve
both the current session and stored save. Keep the legacy version fixed on future
bumps so those saves cannot silently load after a compatibility break.

## Structure and Codex workflow

See [the architecture guide](docs/architecture/README.md) for folder responsibilities.
Phaser scenes, entities and rendering live in `src/game`; pure gameplay rules live
in `src/domain`. Persistent systems are grouped by responsibility under
`src/app/services`, authored JSON lives in `src/content`, and React overlays live
in `src/ui`. Bootstrap composes systems through typed contracts.

You own architecture, contracts, dependency choices, and final integration. Use one
chat per bounded task: gameplay, UI, or content/assets. Role briefs are in .codex/agents.
They are prompt references, not automatically registered agents. Keep shared contracts
in one integration task. Use separate branches/worktrees for concurrent writers.
Chats should exchange written handoffs; do not assume they share conversation memory.

Copy docs/tasks/TEMPLATE.md and give the chat an explicit scope, for example:

> Read AGENTS.md, .codex/agents/ui.md, and docs/tasks/my-task.md.
> Implement the assigned UI scope. Propose contract changes first. Do not commit.
> Report changed files, check results, and integration steps.

Review the diff and run checks before accepting each change. AGENTS.md is recognized
by Codex; role briefs and task documents are project conventions. See the
[official OpenAI workflow guidance](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex).
