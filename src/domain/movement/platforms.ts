export interface Platform { id: string; left: number; right: number; y: number; rightY?: number; bottom?: number }
export interface VerticalState { y: number; velocity: number; grounded: boolean; supportId?: string }

export function restingAt(y: number): VerticalState { return { y, velocity: 0, grounded: true } }
export function jumpGravity(height: number, durationMs: number): number { return 8 * height / (durationMs / 1000) ** 2 }

export function beginJump(state: VerticalState, height: number, gravity: number): VerticalState {
  if (!state.grounded || height <= 0) return state
  return { y: state.y, velocity: -Math.sqrt(2 * gravity * height), grounded: false }
}

/** Sweep the hero's body against solid sides, allowing passage above or below them. */
export function blockedHorizontal(fromX: number, toX: number, feetY: number, halfWidth: number,
  height: number, platforms: readonly Platform[]): number {
  let result = toX
  for (const platform of platforms) {
    if (platform.bottom === undefined || feetY <= platform.y + 1e-6 || feetY - height >= platform.bottom - 1e-6) continue
    if (toX > fromX && fromX + halfWidth <= platform.left + 1e-6 && result + halfWidth > platform.left) {
      result = platform.left - halfWidth
    } else if (toX < fromX && fromX - halfWidth >= platform.right - 1e-6 && result - halfWidth < platform.right) {
      result = platform.right + halfWidth
    }
  }
  return result
}

function overlaps(x: number, halfWidth: number, platform: Platform): boolean {
  return x + halfWidth > platform.left && x - halfWidth < platform.right
}

function surfaceY(platform: Platform, x: number): number {
  if (platform.rightY === undefined) return platform.y
  const fraction = Math.max(0, Math.min(1, (x - platform.left) / (platform.right - platform.left)))
  return platform.y + (platform.rightY - platform.y) * fraction
}

function connected(a: Platform, b: Platform): boolean {
  return (Math.abs(a.right - b.left) < 1e-6 && Math.abs((a.rightY ?? a.y) - b.y) < 1e-6)
    || (Math.abs(b.right - a.left) < 1e-6 && Math.abs((b.rightY ?? b.y) - a.y) < 1e-6)
}

/** One-way tops allow jumping from below. Swept vertical checks prevent falling through thin props. */
export function stepVertical(state: VerticalState, x: number, halfWidth: number, elapsed: number,
  gravity: number, floorY: number, ceilingY: number, platforms: readonly Platform[], bodyHeight = 0): VerticalState {
  if (state.grounded) {
    const previous = platforms.find(platform => platform.id === state.supportId)
    const support = previous && (platforms.find(platform => platform !== previous && connected(previous, platform)
      && x >= platform.left && x <= platform.right) ?? (overlaps(x, halfWidth, previous) ? previous : undefined))
    if (!state.supportId && state.y === floorY) return state
    if (support && (support.rightY !== undefined || support !== previous || support.y === state.y)) {
      return { ...state, y: surfaceY(support, x), supportId: support.id }
    }
    state = { y: state.y, velocity: 0, grounded: false }
  }
  let y = state.y + state.velocity * elapsed + gravity * elapsed ** 2 / 2
  let velocity = state.velocity + gravity * elapsed
  if (y < state.y) {
    const underside = platforms.filter(platform => platform.bottom !== undefined && overlaps(x, halfWidth, platform)
      && state.y - bodyHeight >= platform.bottom - 1e-6 && y - bodyHeight < platform.bottom)
      .sort((a, b) => b.bottom! - a.bottom!)[0]
    if (underside) { y = underside.bottom! + bodyHeight; velocity = Math.max(0, velocity) }
  }
  if (y < ceilingY) { y = ceilingY; velocity = Math.max(0, velocity) }
  if (velocity >= 0) {
    const ground: Platform = { id: '', left: -Infinity, right: Infinity, y: floorY }
    const landing = [...platforms, ground].map(platform => ({ ...platform, y: surfaceY(platform, x) })).filter(platform => overlaps(x, halfWidth, platform)
      && state.y <= platform.y + 1e-6 && y >= platform.y)
      .sort((a, b) => a.y - b.y)[0]
    if (landing) return { y: landing.y, velocity: 0, grounded: true, supportId: landing.id || undefined }
  }
  return { y, velocity, grounded: false }
}
