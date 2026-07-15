let heapPtr: i32 = 1024;

export function alloc(size: i32): i32 {
  const ptr = heapPtr;
  heapPtr = (heapPtr + size + 15) & ~15;
  const needed = (heapPtr + 65535) >>> 16;
  const current = memory.size();
  if (needed > current) memory.grow(needed - current);
  return ptr;
}

export function process(
  ptr: i32,
  len: i32,
  width: i32,
  height: i32,
  threshold: i32
): void {
  for (let i: i32 = 0; i < len; i += 4) {
    const r = load<u8>(ptr + i) as i32;
    const g = load<u8>(ptr + i + 1) as i32;
    const b = load<u8>(ptr + i + 2) as i32;
    const luma = (r * 299 + g * 587 + b * 114) / 1000;
    const v: u8 = luma >= threshold ? 255 : 0;
    store<u8>(ptr + i, v);
    store<u8>(ptr + i + 1, v);
    store<u8>(ptr + i + 2, v);
  }
}
