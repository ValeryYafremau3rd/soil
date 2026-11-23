import type { SurfaceDefinition } from '../../../content/types'

/**
 * Perform require condition.
 * @param {unknown} condition - The condition supplied to this operation.
 * @param {string} message - The message supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

/**
 * Perform unique.
 * @param {readonly string[]} ids - The ids supplied to this operation.
 * @param {string} path - The path supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function unique(ids: readonly string[], path: string): void {
  requireCondition(new Set(ids).size === ids.length, `${path}: IDs must be unique`)
}

/**
 * Perform reference.
 * @param {object} registry - The registry supplied to this operation.
 * @param {string} id - The id supplied to this operation.
 * @param {string} path - The path supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function reference(registry: object, id: string, path: string): void {
  requireCondition(Object.hasOwn(registry, id), `${path}: unknown ID "${id}"`)
}

/**
 * Perform surfaces.
 * @param {readonly SurfaceDefinition[]} definitions - Authored definitions used to resolve identifiers and rules.
 * @param {string} path - The path supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function surfaces(
  definitions: readonly SurfaceDefinition[] = [],
  path: string
): void {
  for (const surface of definitions) {
    requireCondition(surface.left < surface.right, `${path}: left must be less than right`)
    if (surface.bottom !== undefined) requireCondition(surface.bottom > Math.max(surface.top, surface.rightTop ?? surface.top),
      `${path}: solid bottom must be below its top`)
  }
}
