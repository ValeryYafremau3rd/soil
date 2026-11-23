/**
 * Sprite atlases can leave isolated compression specks after color-key removal.
 * @param {Uint8ClampedArray<ArrayBufferLike>} data - The data supplied to this operation.
 * @param {number} width - The width supplied to this operation.
 * @param {number} height - The height supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function keepLargestComponent(
  data: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const labels = new Uint32Array(width * height)
  const queue = new Uint32Array(width * height)
  let label = 0, largest = 0, largestSize = 0

  for (let start = 0;start < labels.length;start++) {
    if (labels[start] || !data[start * 4 + 3]) continue

    label++
    let head = 0, tail = 1
    queue[0] = start
    labels[start] = label
    while (head < tail) {
      const pixel = queue[head++]
      const x = pixel % width, y = Math.floor(pixel / width)

      for (let dy = -1;dy <= 1;dy++) for (let dx = -1;dx <= 1;dx++) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue

        const neighbor = ny * width + nx
        if (labels[neighbor] || !data[neighbor * 4 + 3]) continue

        labels[neighbor] = label
        queue[tail++] = neighbor
      }
    }
    if (tail > largestSize) {
      largest = label
      largestSize = tail
    }
  }

  for (let pixel = 0;pixel < labels.length;pixel++) if (labels[pixel] !== largest) data[pixel * 4 + 3] = 0
}
