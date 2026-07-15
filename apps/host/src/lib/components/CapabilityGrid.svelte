<script lang="ts">
  import type { PluginCapability } from "@swp/plugin-sdk";
  import { ALLOWED_CAPABILITIES } from "../plugin-loader";

  let { declared }: { declared: PluginCapability[] } = $props();

  // Full set the UI shows so the reader can see what a plugin *cannot* do too.
  const ALL: { key: PluginCapability | "dom" | "other-plugins"; label: string }[] = [
    { key: "read-pixels", label: "Read pixels" },
    { key: "write-pixels", label: "Write pixels" },
    { key: "log", label: "Host logging" },
    { key: "network", label: "Network access" },
    { key: "filesystem", label: "Filesystem" },
    { key: "dom", label: "DOM / host objects" },
    { key: "other-plugins", label: "Other plugins' memory" },
  ];

  function status(key: string): "granted" | "requested-denied" | "impossible" {
    if (key === "dom" || key === "other-plugins") return "impossible";
    const cap = key as PluginCapability;
    const requested = declared.includes(cap);
    const allowed = ALLOWED_CAPABILITIES.includes(cap);
    if (requested && allowed) return "granted";
    if (requested && !allowed) return "requested-denied";
    return "impossible";
  }
</script>

<div class="grid">
  {#each ALL as cap (cap.key)}
    {@const s = status(cap.key)}
    <div class="row {s}">
      <span class="icon" aria-hidden="true">
        {#if s === "granted"}✓{:else if s === "requested-denied"}✗{:else}·{/if}
      </span>
      <span class="label">{cap.label}</span>
      <span class="note">
        {#if s === "granted"}granted{:else if s === "requested-denied"}<strong>requested — DENIED</strong>{:else}not requested / structurally impossible{/if}
      </span>
    </div>
  {/each}
</div>
<p class="footnote">
  Structural impossibilities aren't policy — they come from WebAssembly itself. A
  module has no way to reach the DOM, another module's memory, or the network
  unless the host explicitly hands it an import.
</p>

<style>
  .grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .row {
    display: grid;
    grid-template-columns: 20px 160px 1fr;
    gap: 10px;
    align-items: center;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 0.9rem;
  }
  .row.granted {
    background: color-mix(in oklab, var(--ok) 12%, transparent);
  }
  .row.requested-denied {
    background: color-mix(in oklab, var(--err) 15%, transparent);
    border-left: 3px solid var(--err);
    padding-left: 7px;
  }
  .row.impossible {
    color: var(--muted);
  }
  .icon {
    text-align: center;
    font-weight: 700;
  }
  .granted .icon {
    color: var(--ok);
  }
  .requested-denied .icon {
    color: var(--err);
  }
  .footnote {
    color: var(--muted);
    font-size: 0.8rem;
    margin: 10px 0 0;
  }
</style>
