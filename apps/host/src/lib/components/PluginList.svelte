<script lang="ts">
  import type { PluginManifest } from "@swp/plugin-sdk";
  import { ALLOWED_CAPABILITIES } from "../plugin-loader";

  let {
    plugins,
    selected,
    onSelect,
  }: {
    plugins: PluginManifest[];
    selected: string | null;
    onSelect: (name: string) => void;
  } = $props();

  function isRisky(m: PluginManifest): boolean {
    return m.capabilities.some(
      (c) => !ALLOWED_CAPABILITIES.includes(c),
    );
  }
</script>

<ul>
  {#each plugins as p (p.name)}
    <li>
      <button
        class:selected={selected === p.name}
        class:risky={isRisky(p)}
        onclick={() => onSelect(p.name)}
      >
        <span class="dot" aria-hidden="true"></span>
        <span class="label">{p.label}</span>
        {#if isRisky(p)}
          <span class="badge" title="Declares extra capabilities">⚠</span>
        {/if}
      </button>
    </li>
  {/each}
</ul>

<style>
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    text-align: left;
    background: transparent;
    border: 1px solid transparent;
    padding: 8px 10px;
    border-radius: 6px;
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }
  button:hover {
    background: var(--panel-2);
  }
  button.selected {
    background: var(--panel-2);
    border-color: var(--accent);
  }
  button.risky .dot {
    background: var(--err);
    box-shadow: 0 0 8px color-mix(in oklab, var(--err) 70%, transparent);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ok);
    flex-shrink: 0;
  }
  .label {
    flex: 1;
  }
  .badge {
    color: var(--warn);
  }
</style>
