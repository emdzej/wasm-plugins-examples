import type {
  PluginManifest,
  PluginExports,
  PluginCapability,
  PluginIndexEntry,
} from "@swp/plugin-sdk";

// Capabilities the host is willing to grant. Everything a well-behaved
// image filter needs — and nothing else.
export const ALLOWED_CAPABILITIES: readonly PluginCapability[] = [
  "read-pixels",
  "write-pixels",
];

export class CapabilityDeniedError extends Error {
  constructor(
    public readonly plugin: string,
    public readonly denied: PluginCapability[],
  ) {
    super(
      `Plugin '${plugin}' requested disallowed capabilities: ${denied.join(", ")}`,
    );
    this.name = "CapabilityDeniedError";
  }
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  exports: PluginExports;
  wasmBytes: number;
  loadTimeMs: number;
  declaredImports: Array<{ module: string; name: string; kind: string }>;
}

// Resolve relative to Vite's base URL so the demo works both at "/" (dev)
// and under a subpath like "/wasm-plugins-examples/" (GitHub Pages).
const PLUGINS_ROOT = `${import.meta.env.BASE_URL}plugins/`;

/** Fetches the plugin index (index.json) and every plugin's manifest. */
export async function discoverPlugins(): Promise<PluginManifest[]> {
  const res = await fetch(`${PLUGINS_ROOT}index.json`);
  if (!res.ok) throw new Error(`Cannot read plugin index: HTTP ${res.status}`);
  const entries = (await res.json()) as PluginIndexEntry[];

  const manifests = await Promise.all(
    entries.map(async (entry) => {
      const mRes = await fetch(`${PLUGINS_ROOT}${entry.manifest}`);
      if (!mRes.ok) {
        throw new Error(`Cannot read manifest for ${entry.name}: HTTP ${mRes.status}`);
      }
      return (await mRes.json()) as PluginManifest;
    }),
  );
  return manifests;
}

/**
 * Load and instantiate a plugin. The `forceLoad` escape hatch skips the
 * capability check — used by the demo to prove the WASM runtime itself
 * rejects malicious modules even when the host-level check is bypassed.
 */
export async function loadPlugin(
  manifest: PluginManifest,
  opts: { forceLoad?: boolean } = {},
): Promise<LoadedPlugin> {
  const forceLoad = opts.forceLoad ?? false;

  if (!forceLoad) {
    const denied = manifest.capabilities.filter(
      (c) => !ALLOWED_CAPABILITIES.includes(c),
    );
    if (denied.length > 0) {
      throw new CapabilityDeniedError(manifest.name, denied);
    }
  }

  const url = `${PLUGINS_ROOT}${manifest.wasm}`;
  const t0 = performance.now();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Cannot fetch wasm for ${manifest.name}: HTTP ${res.status}`);
  const bytes = await res.arrayBuffer();

  // Inspect the module's declared imports before instantiation. This is
  // purely for the demo UI ("what does this plugin ask for?"); the actual
  // enforcement happens because we pass an empty importObject below.
  const wasmModule = await WebAssembly.compile(bytes);
  const declaredImports = WebAssembly.Module.imports(wasmModule).map((imp) => ({
    module: imp.module,
    name: imp.name,
    kind: imp.kind,
  }));

  // Empty importObject. If the module declares any imports, instantiation
  // throws WebAssembly.LinkError right here.
  const instance = await WebAssembly.instantiate(wasmModule, {});
  const exports = instance.exports as unknown as PluginExports;

  return {
    manifest,
    exports,
    wasmBytes: bytes.byteLength,
    loadTimeMs: performance.now() - t0,
    declaredImports,
  };
}

export interface ProcessResult {
  imageData: ImageData;
  processMs: number;
}

/** Copies image bytes into the plugin's memory, calls process(), copies back. */
export function runPlugin(
  plugin: LoadedPlugin,
  source: ImageData,
  paramValues: number[],
): ProcessResult {
  const { exports } = plugin;
  const bytes = source.data;
  const len = bytes.byteLength;

  const ptr = exports.alloc(len);

  // memory.buffer may have been replaced by memory.grow() during alloc,
  // so create the view *after* alloc.
  const heapIn = new Uint8Array(exports.memory.buffer);
  heapIn.set(bytes, ptr);

  const t0 = performance.now();
  exports.process(ptr, len, source.width, source.height, ...paramValues);
  const t1 = performance.now();

  const heapOut = new Uint8Array(exports.memory.buffer);
  const output = new Uint8ClampedArray(len);
  output.set(heapOut.subarray(ptr, ptr + len));
  return {
    imageData: new ImageData(output, source.width, source.height),
    processMs: t1 - t0,
  };
}
