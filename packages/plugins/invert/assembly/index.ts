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
    store<u8>(ptr + i, (255 - (load<u8>(ptr + i) as i32)) as u8);
    store<u8>(ptr + i + 1, (255 - (load<u8>(ptr + i + 1) as i32)) as u8);
    store<u8>(ptr + i + 2, (255 - (load<u8>(ptr + i + 2) as i32)) as u8);
  }
}
