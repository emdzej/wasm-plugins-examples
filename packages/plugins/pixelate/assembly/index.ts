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
  blockSize: i32
): void {
  if (blockSize < 1) blockSize = 1;
  const stride = width * 4;
  for (let by: i32 = 0; by < height; by += blockSize) {
    for (let bx: i32 = 0; bx < width; bx += blockSize) {
      const sample = ptr + by * stride + bx * 4;
      const r = load<u8>(sample);
      const g = load<u8>(sample + 1);
      const b = load<u8>(sample + 2);
      const a = load<u8>(sample + 3);
      const maxY = by + blockSize < height ? by + blockSize : height;
      const maxX = bx + blockSize < width ? bx + blockSize : width;
      for (let y: i32 = by; y < maxY; y++) {
        for (let x: i32 = bx; x < maxX; x++) {
          const idx = ptr + y * stride + x * 4;
          store<u8>(idx, r);
          store<u8>(idx + 1, g);
          store<u8>(idx + 2, b);
          store<u8>(idx + 3, a);
        }
      }
    }
  }
}
