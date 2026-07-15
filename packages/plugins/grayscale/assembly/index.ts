// Bump allocator over linear memory. Host calls alloc() to reserve a buffer,
// writes RGBA bytes into it, then calls process(). No frees — a fresh module
// instance is created per host call in the demo.
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
  for (let i: i32 = 0; i < len; i += 4) {
    const r = load<u8>(ptr + i) as i32;
    const g = load<u8>(ptr + i + 1) as i32;
    const b = load<u8>(ptr + i + 2) as i32;
    const gray = (r * 299 + g * 587 + b * 114) / 1000;
    store<u8>(ptr + i, gray as u8);
    store<u8>(ptr + i + 1, gray as u8);
    store<u8>(ptr + i + 2, gray as u8);
  }
}
