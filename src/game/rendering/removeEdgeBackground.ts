// Preserve pale details enclosed by the object, including its window panes.
export type BackgroundMask = 'light' | 'dark' | ((red: number, green: number, blue: number) => boolean)

export function removeEdgeBackground(data: Uint8ClampedArray, width: number, height: number, mode: BackgroundMask = 'light'): void {
  const visited = new Uint8Array(width * height)
  const queue = new Uint32Array(width * height)
  let head = 0
  let tail = 0
  const enqueue = (pixel: number): void => {
    if (visited[pixel]) return
    visited[pixel] = 1
    const offset = pixel * 4
    const red = data[offset]
    const green = data[offset + 1]
    const blue = data[offset + 2]
    const isBackground = typeof mode === 'function' ? mode(red, green, blue)
      : mode === 'dark' ? Math.max(red, green, blue) <= 6
        : Math.min(red, green, blue) >= 225 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 15
    if (data[offset + 3] && !isBackground) return
    data[offset + 3] = 0
    queue[tail++] = pixel
  }
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x) }
  for (let y = 0; y < height; y++) { enqueue(y * width); enqueue(y * width + width - 1) }
  while (head < tail) {
    const pixel = queue[head++]
    const x = pixel % width
    if (x > 0) enqueue(pixel - 1)
    if (x < width - 1) enqueue(pixel + 1)
    if (pixel >= width) enqueue(pixel - width)
    if (pixel < (height - 1) * width) enqueue(pixel + width)
  }
}
