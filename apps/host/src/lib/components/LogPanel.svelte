<script lang="ts">
  export type LogKind = "info" | "warn" | "error";
  export interface LogEntry {
    time: string;
    kind: LogKind;
    msg: string;
  }

  let { entries }: { entries: LogEntry[] } = $props();
</script>

<div class="log">
  {#each entries as entry, i (i + entry.time + entry.msg)}
    <div class="line {entry.kind}">
      <span class="time">{entry.time}</span>
      <span class="msg">{entry.msg}</span>
    </div>
  {/each}
  {#if entries.length === 0}
    <div class="empty">Nothing yet.</div>
  {/if}
</div>

<style>
  .log {
    background: #0b0d12;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 0.8rem;
    max-height: 260px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .line {
    display: grid;
    grid-template-columns: 62px 1fr;
    gap: 8px;
  }
  .time {
    color: var(--muted);
  }
  .msg {
    white-space: pre-wrap;
    word-break: break-word;
  }
  .info .msg {
    color: var(--text);
  }
  .warn .msg {
    color: var(--warn);
  }
  .error .msg {
    color: var(--err);
  }
  .empty {
    color: var(--muted);
    text-align: center;
    padding: 20px 0;
  }
</style>
