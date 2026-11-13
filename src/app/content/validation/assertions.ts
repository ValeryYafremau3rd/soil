import type { SurfaceDefinition } from '../../../content/types'

export function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function unique(ids: readonly string[], path: string): void {
  requireCondition(new Set(ids).size === ids.length, `${path}: IDs must be unique`)
}

export function reference(registry: object, id: string, path: string): void {
  requireCondition(Object.hasOwn(registry, id), `${path}: unknown ID "${id}"`)
}

export function surfaces(definitions: readonly SurfaceDefinition[] = [], path: string): void {
  for (const surface of definitions) {
    requireCondition(surface.left < surface.right, `${path}: left must be less than right`)
    if (surface.bottom !== undefined) requireCondition(surface.bottom > Math.max(surface.top, surface.rightTop ?? surface.top),
      `${path}: solid bottom must be below its top`)
  }
}
