<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { PluginManifest } from "@swp/plugin-sdk";
  import {
    discoverPlugins,
    loadPlugin,
    runPlugin,
    CapabilityDeniedError,
    ALLOWED_CAPABILITIES,
    type LoadedPlugin,
  } from "./lib/plugin-loader";
  import PluginList from "./lib/components/PluginList.svelte";
  import CapabilityGrid from "./lib/components/CapabilityGrid.svelte";
  import ParamControls from "./lib/components/ParamControls.svelte";
  import LogPanel, { type LogEntry, type LogKind } from "./lib/components/LogPanel.svelte";

  let manifests = $state<PluginManifest[]>([]);
  let discoveryError = $state<string | null>(null);
  let selectedName = $state<string | null>(null);
  let selectedManifest = $derived(
    manifests.find((m) => m.name === selectedName) ?? null,
  );
  let isSelectedRisky = $derived(
    selectedManifest !== null &&
      selectedManifest.capabilities.some(
        (c) => !ALLOWED_CAPABILITIES.includes(c),
      ),
  );

  let paramValues = $state<Record<string, number>>({});
  let loadedPlugin = $state<LoadedPlugin | null>(null);
  let originalImageData = $state<ImageData | null>(null);
  let previewImageData = $state<ImageData | null>(null);
  let forceLoad = $state(false);
  let logEntries = $state<LogEntry[]>([]);

  function log(kind: LogKind, msg: string) {
    const time = new Date().toTimeString().slice(0, 8);
    logEntries = [{ time, kind, msg }, ...logEntries].slice(0, 200);
  }

  onMount(async () => {
    try {
      manifests = await discoverPlugins();
      log("info", `Discovered ${manifests.length} plugins`);
    } catch (e) {
      const msg = (e as Error).message;
      discoveryError = msg;
      log("error", `Plugin discovery failed: ${msg}`);
    }
  });

  // Reset per-plugin state whenever the selection changes.
  $effect(() => {
    selectedName;
    untrack(() => {
      if (!selectedManifest) {
        paramValues = {};
      } else {
        const next: Record<string, number> = {};
        for (const p of selectedManifest.params) next[p.name] = p.default;
        paramValues = next;
      }
      loadedPlugin = null;
      previewImageData = null;
    });
  });

  async function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await loadImageFile(file);
  }

  async function loadImageFile(file: File | Blob) {
    try {
      const bmp = await createImageBitmap(file);
      const canvas = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      originalImageData = ctx.getImageData(0, 0, bmp.width, bmp.height);
      previewImageData = null;
      log(
        "info",
        `Loaded image ${bmp.width}×${bmp.height} (${(originalImageData.data.byteLength / 1024).toFixed(1)} KB)`,
      );
    } catch (e) {
      log("error", `Could not read image: ${(e as Error).message}`);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) void loadImageFile(file);
  }

  let dragging = $state(false);

  async function loadSelected() {
    if (!selectedManifest) return;
    try {
      const plugin = await loadPlugin(selectedManifest, { forceLoad });
      loadedPlugin = plugin;
      const importSummary =
        plugin.declaredImports.length === 0
          ? "no imports"
          : plugin.declaredImports
              .map((i) => `${i.module}.${i.name}`)
              .join(", ");
      log(
        "info",
        `Loaded ${plugin.manifest.name} — ${plugin.wasmBytes} B, ${plugin.loadTimeMs.toFixed(1)}ms, imports: ${importSummary}`,
      );
    } catch (e) {
      loadedPlugin = null;
      if (e instanceof CapabilityDeniedError) {
        log(
          "warn",
          `Sandbox (capability check) rejected ${e.plugin}: ${e.denied.join(", ")}`,
        );
      } else {
        log(
          "error",
          `Sandbox (WebAssembly runtime) rejected load: ${(e as Error).message}`,
        );
      }
    }
  }

  function apply() {
    if (!loadedPlugin || !originalImageData || !selectedManifest) return;
    const values = selectedManifest.params.map(
      (p) => paramValues[p.name] ?? p.default,
    );
    try {
      const result = runPlugin(loadedPlugin, originalImageData, values);
      previewImageData = result.imageData;
      log(
        "info",
        `Applied ${loadedPlugin.manifest.name} in ${result.processMs.toFixed(2)}ms`,
      );
    } catch (e) {
      log("error", `Runtime error: ${(e as Error).message}`);
    }
  }

  // Render image data into the two canvases whenever it changes.
  let originalCanvas: HTMLCanvasElement | undefined = $state();
  let previewCanvas: HTMLCanvasElement | undefined = $state();

  $effect(() => {
    if (originalImageData && originalCanvas) {
      originalCanvas.width = originalImageData.width;
      originalCanvas.height = originalImageData.height;
      originalCanvas.getContext("2d")!.putImageData(originalImageData, 0, 0);
    }
  });
  $effect(() => {
    if (previewImageData && previewCanvas) {
      previewCanvas.width = previewImageData.width;
      previewCanvas.height = previewImageData.height;
      previewCanvas.getContext("2d")!.putImageData(previewImageData, 0, 0);
    }
  });
</script>

<div class="app">
  <header>
    <div class="title">
      <h1>svelte-wasm-plugins</h1>
      <p class="tag">
        Svelte host loading sandboxed AssemblyScript image filters
      </p>
    </div>
    <div class="upload">
      <label class="file-btn">
        <input type="file" accept="image/*" onchange={onFileChange} />
        <span>Choose image</span>
      </label>
    </div>
  </header>

  <main>
    <aside class="sidebar">
      <h2>Plugins</h2>
      {#if discoveryError}
        <p class="err">
          Could not load the plugin index. Run <code>pnpm build:plugins</code> first.
        </p>
      {:else if manifests.length === 0}
        <p class="muted">Loading…</p>
      {:else}
        <PluginList
          plugins={manifests}
          selected={selectedName}
          onSelect={(name) => (selectedName = name)}
        />
      {/if}
    </aside>

    <section class="workspace">
      <div class="canvas-row">
        <div
          class="canvas-card"
          class:dragging
          ondragover={(e) => {
            e.preventDefault();
            dragging = true;
          }}
          ondragleave={() => (dragging = false)}
          ondrop={onDrop}
          role="region"
          aria-label="Original image"
        >
          <div class="canvas-label">Original</div>
          {#if originalImageData}
            <canvas bind:this={originalCanvas}></canvas>
          {:else}
            <div class="placeholder">
              <p>Drop an image here or use <em>Choose image</em>.</p>
            </div>
          {/if}
        </div>

        <div class="canvas-card" role="region" aria-label="Preview">
          <div class="canvas-label">Preview</div>
          {#if previewImageData}
            <canvas bind:this={previewCanvas}></canvas>
          {:else}
            <div class="placeholder">
              <p>Apply a plugin to see the result.</p>
            </div>
          {/if}
        </div>
      </div>

      {#if selectedManifest}
        <div class="details">
          <div class="details-head">
            <div>
              <h3>{selectedManifest.label}</h3>
              <p class="muted small">{selectedManifest.description}</p>
            </div>
            {#if loadedPlugin}
              <div class="pill success" title="Bytes in the compiled .wasm">
                {loadedPlugin.wasmBytes} B
              </div>
            {/if}
          </div>

          {#if isSelectedRisky}
            <div class="banner err">
              <strong>Sandbox alert.</strong> This plugin requests capabilities
              outside the allowlist ({selectedManifest.capabilities
                .filter((c) => !ALLOWED_CAPABILITIES.includes(c))
                .join(", ")}). The host will refuse to load it by default.
              <label class="force">
                <input type="checkbox" bind:checked={forceLoad} />
                Force load anyway (for the demo — WASM runtime will still block it)
              </label>
            </div>
          {/if}

          <div class="details-grid">
            <div>
              <h4>Capabilities</h4>
              <CapabilityGrid declared={selectedManifest.capabilities} />
            </div>
            <div>
              <h4>Parameters</h4>
              <ParamControls
                params={selectedManifest.params}
                bind:values={paramValues}
              />
              <div class="actions">
                <button onclick={loadSelected} disabled={isSelectedRisky && !forceLoad}>
                  {loadedPlugin ? "Reload" : "Load plugin"}
                </button>
                <button
                  class="primary"
                  onclick={apply}
                  disabled={!loadedPlugin || !originalImageData}
                >
                  Apply filter
                </button>
              </div>
            </div>
          </div>

          {#if loadedPlugin && loadedPlugin.declaredImports.length > 0}
            <div class="imports">
              <h4>Declared imports</h4>
              <pre>{loadedPlugin.declaredImports
                  .map((i) => `${i.kind} ${i.module}.${i.name}`)
                  .join("\n")}</pre>
              <p class="muted small">
                Note: the host wired <em>zero</em> imports. If the plugin were
                actually called (via <em>Apply filter</em>), the WASM runtime
                would have thrown <code>LinkError</code> during instantiation —
                which is why <em>Load</em> above only succeeded if it did.
              </p>
            </div>
          {/if}
        </div>
      {:else}
        <div class="empty-state">
          <p>Select a plugin from the sidebar to inspect it.</p>
        </div>
      {/if}

      <div class="log-wrap">
        <h3>Activity log</h3>
        <LogPanel entries={logEntries} />
      </div>
    </section>
  </main>
</div>

<style>
  .app {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }
  h1 {
    margin: 0;
    font-size: 1.4rem;
  }
  .tag {
    margin: 4px 0 0;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .file-btn {
    display: inline-block;
    padding: 8px 14px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
  }
  .file-btn:hover {
    border-color: var(--accent);
  }
  .file-btn input {
    display: none;
  }

  main {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 20px;
    align-items: start;
  }

  .sidebar {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    position: sticky;
    top: 20px;
  }
  .sidebar h2 {
    margin: 0 0 10px;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }

  .workspace {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .canvas-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .canvas-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    min-height: 220px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .canvas-card.dragging {
    border-color: var(--accent);
    background: color-mix(in oklab, var(--accent) 8%, var(--panel));
  }
  .canvas-label {
    font-size: 0.8rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  canvas {
    max-width: 100%;
    max-height: 400px;
    height: auto;
    object-fit: contain;
    align-self: center;
    image-rendering: pixelated;
  }
  .placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    border: 1px dashed var(--border);
    border-radius: 6px;
  }

  .details {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .details-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .details-head h3 {
    margin: 0;
  }
  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .details-grid h4 {
    margin: 0 0 10px;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 14px;
  }

  .banner {
    padding: 10px 12px;
    border-radius: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: baseline;
  }
  .banner.err {
    background: color-mix(in oklab, var(--err) 12%, transparent);
    border: 1px solid color-mix(in oklab, var(--err) 40%, transparent);
  }
  .force {
    margin-left: auto;
    font-size: 0.85rem;
    color: var(--muted);
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .imports pre {
    background: #0b0d12;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 8px 10px;
    font-size: 0.8rem;
    overflow-x: auto;
    margin: 0;
  }
  .imports h4 {
    margin: 0 0 8px;
    font-size: 0.85rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .empty-state {
    padding: 40px;
    text-align: center;
    color: var(--muted);
    background: var(--panel);
    border: 1px dashed var(--border);
    border-radius: 8px;
  }

  .log-wrap h3 {
    margin: 0 0 8px;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }

  .pill {
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-family: ui-monospace, monospace;
  }
  .pill.success {
    background: color-mix(in oklab, var(--ok) 20%, transparent);
    color: var(--ok);
  }

  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 0.85rem;
  }
  .err {
    color: var(--err);
  }

  @media (max-width: 900px) {
    main {
      grid-template-columns: 1fr;
    }
    .details-grid,
    .canvas-row {
      grid-template-columns: 1fr;
    }
    .sidebar {
      position: static;
    }
  }
</style>
