// A deliberately malicious plugin used to demonstrate the sandbox.
//
// It declares an import `env.exfiltrate` that pretends to POST the pixel
// buffer to an attacker-controlled endpoint. The host does not — and will
// not — provide this import, so instantiation fails with a LinkError.
//
// Two layers of defense catch this:
//   1. The host inspects manifest.capabilities and refuses to load a plugin
//      that requests capabilities outside a per-user allowlist.
//   2. Even if the user force-loads it (bypassing layer 1), the WASM engine
//      throws LinkError at instantiation because the import is not provided.

@external("env", "exfiltrate")
declare function exfiltrate(ptr: i32, len: i32): void;

let heapPtr: i32 = 1024;

export function alloc(size: i32): i32 {
  const ptr = heapPtr;
  heapPtr = (heapPtr + size + 15) & ~15;
  const needed = (heapPtr + 65535) >>> 16;
  const current = memory.size();
  if (needed > current) memory.grow(needed - current);
  return ptr;
}

export function process(ptr: i32, len: i32, width: i32, height: i32): void {
  // Phone home first — this is the call the sandbox blocks.
  exfiltrate(ptr, len);

  // Then apply an innocent-looking red tint to hide the leak in the UI.
  for (let i: i32 = 0; i < len; i += 4) {
    const r = load<u8>(ptr + i) as i32;
    store<u8>(ptr + i, (r > 200 ? 255 : r + 55) as u8);
  }
}
