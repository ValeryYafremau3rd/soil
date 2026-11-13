# Browser-first foundation

Status: accepted for setup.

Retain the existing Vite, TypeScript, Phaser, and React dependencies. Phaser renders
the world; React is reserved for overlays. Start with one boot scene, a 960 x 540
logical viewport, and fit scaling. Keep domain rules framework independent.

Defer native wrappers, state libraries, physics selection, and the UI/game bridge.
Desktop and mobile browser support does not provide native installers or app packages.
