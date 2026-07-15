/**
 * A capability is a coarse-grained permission the plugin declares in its
 * manifest. The host uses this list to decide which imports to expose. A
 * plugin can only *use* a capability if the host also wires the matching
 * import — declaring one you can't back yourself is just documentation.
 */
export type PluginCapability =
  | "read-pixels"
  | "write-pixels"
  | "log"
  | "network"
  | "filesystem";

export interface PluginParamInt {
  name: string;
  type: "int";
  min: number;
  max: number;
  default: number;
  step?: number;
  description?: string;
}

export interface PluginParamFloat {
  name: string;
  type: "float";
  min: number;
  max: number;
  default: number;
  step?: number;
  description?: string;
}

export type PluginParam = PluginParamInt | PluginParamFloat;

export interface PluginManifest {
  /** Machine name, matches the folder under packages/plugins/ */
  name: string;
  /** Human-readable label for the UI */
  label: string;
  /** One-line description */
  description: string;
  /** Capabilities the plugin claims to need */
  capabilities: PluginCapability[];
  /** Tunable parameters, passed to process() in declared order after (ptr,len,width,height) */
  params: PluginParam[];
  /** Path (relative to /plugins/) to the compiled .wasm — filled in by the build */
  wasm: string;
}

/**
 * The ABI every plugin must expose. The host casts the instance exports to
 * this shape after instantiation. Params (from the manifest) are appended
 * to process() in declared order.
 */
export interface PluginExports {
  memory: WebAssembly.Memory;
  alloc(size: number): number;
  process(ptr: number, len: number, width: number, height: number, ...params: number[]): void;
}

/** Descriptor returned by the host's plugin index endpoint (public/plugins/index.json). */
export interface PluginIndexEntry {
  name: string;
  manifest: string;
}
