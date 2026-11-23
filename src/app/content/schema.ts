export type Schema =
  | {
    kind: 'string'
    values?: readonly string[]
  }
  | {
    kind: 'number'
    min?: number
    max?: number
    integer?: boolean
  }
  | {
    kind: 'boolean'
  }
  | {
    kind: 'array'
    item: Schema
    nonempty?: boolean
  }
  | {
    kind: 'record'
    item: Schema
  }
  | {
    kind: 'object'
    fields: Record<string, Schema>
  }
  | {
    kind: 'optional'
    item: Schema
  }
  | {
    kind: 'union'
    items: readonly Schema[]
  }

export const text: Schema = { kind: 'string' }

/**
 * Perform number.
 * @param {number} min - The min supplied to this operation.
 * @param {boolean} integer - The integer supplied to this operation.
 * @param {number | undefined} max - The max supplied to this operation.
 * @returns {Schema} The result described by the TypeScript return signature.
 */
export const number = (
  min = 0,
  integer = false,
  max?: number
): Schema => ({ kind: 'number', min, integer, max })

/**
 * Perform optional.
 * @param {Schema} item - The item supplied to this operation.
 * @returns {Schema} The result described by the TypeScript return signature.
 */
export const optional = (item: Schema): Schema => ({ kind: 'optional', item })

/**
 * Perform array.
 * @param {Schema} item - The item supplied to this operation.
 * @param {boolean} nonempty - The nonempty supplied to this operation.
 * @returns {Schema} The result described by the TypeScript return signature.
 */
export const array = (item: Schema, nonempty = false): Schema => ({ kind: 'array', item, nonempty })

/**
 * Perform record.
 * @param {Schema} item - The item supplied to this operation.
 * @returns {Schema} The result described by the TypeScript return signature.
 */
export const record = (item: Schema): Schema => ({ kind: 'record', item })

/**
 * Perform object.
 * @param {Record<string, Schema>} fields - The fields supplied to this operation.
 * @returns {Schema} The result described by the TypeScript return signature.
 */
export const object = (fields: Record<string, Schema>): Schema => ({ kind: 'object', fields })

/**
 * Perform choice.
 * @param {string[]} values - The values supplied to this operation.
 * @returns {Schema} The result described by the TypeScript return signature.
 */
export const choice = (...values: string[]): Schema => ({ kind: 'string', values })
export const boolean: Schema = { kind: 'boolean' }

/**
 * Validate shape against the supported rules.
 * @param {unknown} value - The value supplied to this operation.
 * @param {Schema} schema - The schema supplied to this operation.
 * @param {string} path - The path supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function validateShape(
  value: unknown,
  schema: Schema,
  path: string
): void {
  /**
   * Perform fail.
   * @param {string} expected - The expected supplied to this operation.
   * @returns {never} The result described by the TypeScript return signature.
   */
  const fail = (expected: string): never => {
    throw new Error(`${path}: expected ${expected}`)
  }
  if (schema.kind === 'optional') {
    if (value !== undefined) validateShape(value, schema.item, path)

    return
  }

  if (schema.kind === 'string') {
    if (typeof value !== 'string' || value.length === 0 || (schema.values && !schema.values.includes(value))) fail(schema.values?.join(' | ') ?? 'non-empty string')

    return
  }

  if (schema.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) || (schema.integer && !Number.isInteger(value))
      || (schema.min !== undefined && value < schema.min) || (schema.max !== undefined && value > schema.max)) fail(`number in range ${schema.min ?? '-∞'}..${schema.max ?? '∞'}`)

    return
  }

  if (schema.kind === 'boolean') {
    if (typeof value !== 'boolean') fail('boolean')

    return
  }

  if (schema.kind === 'array') {
    if (!Array.isArray(value)) return fail('array')

    if (schema.nonempty && !value.length) fail('non-empty array')

    value.forEach((entry, index) => validateShape(entry, schema.item, `${path}[${index}]`))

    return
  }

  if (schema.kind === 'union') {
    for (const candidate of schema.items) {
      try {
        validateShape(value, candidate, path)

        return
      } catch { /* Try the other authored representation. */ }
    }

    return fail('one of the supported value shapes')
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('object')

  const entries = value as Record<string, unknown>
  if (schema.kind === 'record') {
    for (const [key, entry] of Object.entries(entries)) validateShape(entry, schema.item, `${path}.${key}`)
  } else {
    for (const [key, field] of Object.entries(schema.fields)) validateShape(entries[key], field, `${path}.${key}`)

    for (const key of Object.keys(entries)) {
      if (!(key in schema.fields) && key !== '$comment') throw new Error(`${path}.${key}: unknown configuration field`)
    }
  }
}
