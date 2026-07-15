# AGENTS.md

Guidance for AI coding agents working on this repo. Read this before making changes.

## What this is

A demo showing WebAssembly as a **plugin sandbox**: a Svelte host loads AssemblyScript-compiled image filters at runtime, enforces a capability manifest, and demonstrates sandbox rejection of a deliberately malicious plugin. See `README.md` for the user-facing narrative.

The security story is load-bearing. Do not weaken it "for convenience."

## Layout

- `apps/host/` — Svelte 5 + Vite. The only user-facing app.
- `packages/plugin-sdk/` — Shared TypeScript types. Source-only (`main: src/index.ts`); no build step.
- `packages/plugins/<name>/` — One folder per plugin. Each has `manifest.json`, `assembly/index.ts`, `asconfig.json`, `package.json`.
- `scripts/bundle-plugins.mjs` — Copies compiled `.wasm` + manifests into `apps/host/public/plugins/` and writes `index.json`. Runs automatically as part of `pnpm build:plugins`.
- `.github/workflows/deploy-pages.yml` — Deploys `apps/host/dist/` to GitHub Pages under `/<repo>/`.

## Commands

- `pnpm dev` — Build plugins, bundle into host `public/`, start Vite dev server.
- `pnpm build` — Production build → `apps/host/dist/`.
- `pnpm build:plugins` — Recompile plugins + refresh bundle. Fast (~1s).
- `pnpm --filter host check` — `svelte-check`. Run before committing UI changes.

There is no test suite. Verify functionality by running the dev server and exercising the UI (upload an image, apply filters, try to load the malicious plugin).

## Plugin ABI (contract for all plugins)

Every plugin exports:

| Export    | Signature                                                | Purpose                            |
| --------- | -------------------------------------------------------- | ---------------------------------- |
| `memory`  | `WebAssembly.Memory`                                     | Plugin's isolated linear memory    |
| `alloc`   | `(size: i32) => i32`                                     | Bump-allocate a buffer, return ptr |
| `process` | `(ptr, len, width, height, ...params) => void`           | Mutate the RGBA buffer in place    |

`params` are appended to `process()` in the exact order declared in `manifest.json`. The AS function signature must match.

## Non-obvious rules

- **Legit plugins compile with zero WebAssembly imports.** The demo's security story depends on this. Enforced by `asconfig.json`: `runtime: "stub"` + `use: ["abort="]`. Do NOT add plugin features that require imports (host logging, host timing, string throws) unless you also extend the capability model in `plugin-sdk/`, update `ALLOWED_CAPABILITIES` in the host loader, and wire the matching import in `loadPlugin()`. Silently importing something breaks the airtight-sandbox claim in the README.
- **`memory.buffer` is detached by `memory.grow`.** In `plugin-loader.ts::runPlugin`, always construct a fresh `Uint8Array(exports.memory.buffer)` *after* calling `alloc()`. Never hoist the view across an alloc boundary.
- **All host asset URLs use `import.meta.env.BASE_URL`**, not hardcoded `/plugins/`. Preserve this — GitHub Pages serves at `/<repo>/`, dev at `/`.
- **`@swp/plugin-sdk` is source-only.** `main: "./src/index.ts"` — Vite compiles the TS at consume time. Do not add a build step, `dist/`, or `main: "./dist/..."`.
- **Bundled plugin artifacts under `apps/host/public/plugins/` are committed.** This is intentional so the demo runs from a fresh clone without a build step. They're regenerated on every `pnpm build:plugins`; occasional staleness is harmless because CI regenerates them.
- **`packageManager` in root `package.json` is the single source of pnpm version.** Do not add `version:` to `pnpm/action-setup` in the workflow — the action errors on the conflict.

## Adding a new plugin

1. Copy `packages/plugins/grayscale/` to `packages/plugins/<name>/`.
2. Edit `manifest.json`: `name` must match the folder; fill `label`, `description`, `capabilities`, `params`.
3. Edit `assembly/index.ts`: keep the `alloc` skeleton verbatim, put your algorithm in `process(...)`. The signature after `(ptr, len, width, height, ...)` must line up with the declared params.
4. Run `pnpm build:plugins`. The host picks it up automatically — no host code changes.

Do not edit host code to register a new plugin. The host reads the plugin list at runtime from `/plugins/index.json`.

## Adding a new capability

If you genuinely need a host-provided capability (e.g., `log`):

1. Add the string literal to `PluginCapability` in `packages/plugin-sdk/src/index.ts`.
2. Add it to `ALLOWED_CAPABILITIES` in `apps/host/src/lib/plugin-loader.ts` if it should be granted by default.
3. Wire the matching import in `loadPlugin()`: pass a non-empty `importObject` conditional on the capability being granted.
4. Update `CapabilityGrid.svelte` if the UI should surface it.

The malicious plugin exists to demonstrate a *block*. Never add `network`, `filesystem`, or any hypothetical unsafe capability to `ALLOWED_CAPABILITIES`.

## What NOT to change

- Don't move plugins out of `packages/plugins/` — the bundler globs that path.
- Don't add npm dependencies to plugin packages — AssemblyScript compiles them in isolation.
- Don't switch to `import.meta.glob` or bundled imports for plugin loading — the demo's whole point is *runtime* discovery.
- Don't remove the malicious plugin. It's a fixture, not dead code.
- Don't add error handling that hides the `LinkError` / `CapabilityDeniedError` paths from the UI — they're intentionally surfaced in the activity log.
- Don't refactor `alloc` into a shared package. It's copy-pasted per plugin on purpose so each plugin is a self-contained AS project.

## Toolchain

- Node 24 (per workflow), pnpm ≥ 10.33 (per `packageManager`).
- AssemblyScript ^0.27.x. Later majors may change `--use abort=` or the stub runtime.
- Svelte 5 (runes API), Vite 6.

## Deployment

Push to `main` → `.github/workflows/deploy-pages.yml` → GitHub Pages. Base path is derived automatically from `github.event.repository.name`.

Live: <https://emdzej.github.io/wasm-plugins-examples/>
