/**
 * Perform check save.
 * @param {unknown} valid - The valid supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function checkSave(valid: unknown): asserts valid {
  if (!valid) throw new Error('Save contains incompatible content')
}
