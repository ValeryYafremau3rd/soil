const MIN_DIGIT = 1
const DIGIT_COUNT = 9

/**
 * Wrap presentation input through the existing lock's one-to-nine digit range.
 * @param {number} value - Current wheel digit.
 * @param {number} direction - Signed number of wheel steps.
 * @returns {number} Wrapped digit to pass to the typed lockpicking action.
 */
export function rotateLockDigit(value: number, direction: number): number {
  const offset = value - MIN_DIGIT + direction
  return ((offset % DIGIT_COUNT) + DIGIT_COUNT) % DIGIT_COUNT + MIN_DIGIT
}
