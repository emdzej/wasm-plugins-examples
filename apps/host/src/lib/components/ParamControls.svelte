<script lang="ts">
  import type { PluginParam } from "@swp/plugin-sdk";

  let {
    params,
    values = $bindable(),
  }: {
    params: PluginParam[];
    values: Record<string, number>;
  } = $props();
</script>

{#if params.length === 0}
  <p class="empty">This plugin takes no parameters.</p>
{:else}
  <div class="controls">
    {#each params as p (p.name)}
      <label>
        <span class="name">
          <code>{p.name}</code>
          <span class="value">{values[p.name] ?? p.default}</span>
        </span>
        <input
          type="range"
          min={p.min}
          max={p.max}
          step={p.step ?? (p.type === "int" ? 1 : 0.01)}
          bind:value={values[p.name]}
        />
        {#if p.description}<span class="desc">{p.description}</span>{/if}
      </label>
    {/each}
  </div>
{/if}

<style>
  .empty {
    color: var(--muted);
    font-size: 0.9rem;
    margin: 0;
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .name {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .value {
    color: var(--accent);
    font-family: ui-monospace, monospace;
  }
  .desc {
    font-size: 0.78rem;
    color: var(--muted);
  }
</style>
