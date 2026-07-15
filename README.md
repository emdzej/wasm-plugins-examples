# svelte-wasm-plugins

A demo showing how a **Svelte host** can load and safely execute **untrusted image-filter plugins** compiled from **AssemblyScript** to **WebAssembly**.

**Live demo:** <https://emdzej.github.io/wasm-plugins-examples/>

## What is WebAssembly, briefly?

WebAssembly (WASM) is a binary instruction format designed to run at near-native speed in a **strong sandbox**. Every WASM module runs in its own isolated linear memory and can only interact with the outside world through *imports* the host explicitly hands to it. That means:

- A WASM module **cannot** touch the DOM, the network, the filesystem, other tabs, other WASM modules, or the host's memory. Not by design of the language — by construction of the runtime.
- If the host provides no imports, the module can do exactly one thing: compute over the bytes in its own memory.
- Getting data in and out is deliberate: the host writes bytes into the module's memory, calls an exported function, then reads bytes back.

This makes WASM a good fit for **plugin systems**: you can safely run third-party code the same way you run first-party code, without spawning a process or standing up a container.

## What this repo demonstrates

- **Dynamic plugin loading.** The host discovers plugins at runtime from `/plugins/index.json`. Dropping a new folder into `packages/plugins/` and rebuilding is enough — no host code changes.
- **A uniform plugin ABI.** Every plugin exports `memory`, `alloc(size)`, and `process(ptr, len, width, height, ...params)`. The host uses that contract to shuttle image bytes in and out.
- **Capability manifests.** Each plugin ships a `manifest.json` declaring what it needs (`read-pixels`, `write-pixels`, and — for the deliberately-bad one — `network`). The host enforces the allowlist.
- **A deliberately malicious plugin.** It declares `network` and imports `env.exfiltrate`, pretending to POST the pixel buffer somewhere. The host refuses to load it on the capability check, and if you force it, the WebAssembly engine itself raises `LinkError` because the import is not wired. That's the sandbox catching an escape attempt live.
- **Zero imports for the honest plugins.** They are compiled with `--runtime stub --use abort=`, which strips even the standard `abort` import. Every legit plugin loads with an empty `importObject`. There is literally no host function it can call — the sandbox is airtight by construction.

## Workspace layout

```
apps/host/                    Svelte 5 + Vite host application
packages/plugin-sdk/          Shared TypeScript types (PluginManifest, ABI)
packages/plugins/
  grayscale/                  Per-pixel luminosity
  invert/                     Per-pixel color inversion
  sepia/                      Per-pixel matrix multiply
  pixelate/                   Parameterized: blockSize
  threshold/                  Parameterized: threshold
  malicious/                  Declares 'network', imports env.exfiltrate — blocked
scripts/bundle-plugins.mjs    Copies compiled .wasm + manifests into the host's public/
```

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 10

## Getting started

```sh
pnpm install
pnpm dev
```

`pnpm dev` builds every plugin's `.wasm`, bundles the artifacts + manifests into `apps/host/public/plugins/`, and starts the Vite dev server (default: <http://localhost:5173>).

Then in the browser:

1. Drop or select an image.
2. Pick a plugin from the sidebar. Its capability grid, parameters (if any), and code size show up.
3. Tweak parameters and click **Apply**. The bytes round-trip through WASM.
4. Try loading **Exfiltrator (malicious)**. The host refuses it on the capability check. Toggle **Force load anyway** and the WASM engine rejects it with a `LinkError` — proof that the sandbox blocks it even without host-level checks.

## Plugin ABI

Every plugin exports the same three symbols:

| Export    | Signature                                                        | Purpose                            |
| --------- | ---------------------------------------------------------------- | ---------------------------------- |
| `memory`  | `WebAssembly.Memory`                                             | Plugin's isolated linear memory    |
| `alloc`   | `(size: i32) => i32`                                             | Reserve a buffer, return pointer   |
| `process` | `(ptr, len, width, height, ...params) => void`                   | Transform RGBA bytes *in place*    |

Params from the manifest are appended to `process` in declared order.

## Adding a new plugin

1. Copy an existing folder under `packages/plugins/` (e.g. `grayscale/`).
2. Edit `manifest.json` — `name` matches the folder, describe the filter, list `capabilities`, declare `params`.
3. Edit `assembly/index.ts` — same `alloc` skeleton, put your algorithm in `process(...)`.
4. `pnpm dev` — the plugin is picked up automatically at build time.

Because the host reads the plugin list from `public/plugins/index.json` at runtime, you never edit the host to add a plugin.

## Compile flags used

Each plugin's `asconfig.json` sets:

- `runtime: "stub"` — no GC, no dynamic allocator. Our bump allocator is manual.
- `use: ["abort="]` — strips the `env.abort` import. Combined with no other declared imports, the module has *zero* imports.
- `optimizeLevel: 3`, `shrinkLevel: 2` — aggressive size and speed optimizations. Filters compile to ~200-500 bytes of `.wasm`.

## Layout of trust

- **Trusted:** the host code in `apps/host/`.
- **Untrusted:** every `.wasm` in `packages/plugins/`. Treat them as if they came from a third party.
- **Not trusted just because a manifest says so:** the manifest is a *declaration*, enforced by the host wiring only the imports it approves. The plugin cannot lie its way past the runtime.

## Deployment

Pushes to `main` trigger [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml), which builds every plugin, bundles the host, and publishes to GitHub Pages. The workflow uses `BASE_PATH=/<repo>/` at build time so the demo works from a subpath.

One-time setup on a fresh fork:

1. **Settings → Pages → Build and deployment → Source:** *GitHub Actions*.
2. Push to `main` (or run the workflow manually from the Actions tab).

## What this demo does *not* attempt

- Metering CPU / memory / execution time. Real hostile plugins can burn CPU or allocate until OOM inside their own memory. Production systems address this with `WebAssembly.Instance` in a Web Worker plus a hard timeout, or with fuel-metering runtimes (Wasmtime).
- The WASM Component Model. Would give us typed capabilities and richer interfaces at the cost of larger binaries and a heavier toolchain. Out of scope here; the takeaway is that even minimal MVP WebAssembly gives a strong sandbox.
- Signing / provenance. In production you would sign plugin bundles and verify the signature before loading.
