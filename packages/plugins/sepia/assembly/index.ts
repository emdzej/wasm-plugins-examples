let heapPtr: i32 = 1024;

export function alloc(size: i32): i32 {
  const ptr = heapPtr;
  heapPtr = (heapPtr + size + 15) & ~15;
  const needed = (heapPtr + 65535) >>> 16;
  const current = memory.size();
  if (needed > current) memory.grow(needed - current);
  return ptr;
}

@inline
function clamp8(v: i32): u8 {
  return (v > 255 ? 255 : (v < 0 ? 0 : v)) as u8;
}

export function process(ptr: i32, len: i32, width: i32, height: i32): void {
  for (let i: i32 = 0; i < len; i += 4) {
    const r = load<u8>(ptr + i) as i32;
    const g = load<u8>(ptr + i + 1) as i32;
    const b = load<u8>(ptr + i + 2) as i32;
    const nr = (r * 393 + g * 769 + b * 189) / 1000;
    const ng = (r * 349 + g * 686 + b * 168) / 1000;
    const nb = (r * 272 + g * 534 + b * 131) / 1000;
    store<u8>(ptr + i, clamp8(nr));
    store<u8>(ptr + i + 1, clamp8(ng));
    store<u8>(ptr + i + 2, clamp8(nb));
  }
}
