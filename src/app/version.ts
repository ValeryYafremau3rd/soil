/** 0.compatibility.0.update: compatible updates increment the fourth number (always >= 1).
 * Breaking saves increments the second number and restarts the fourth at 1. */
export const GAME_VERSION = '0.2.0.3'

// Saves written before game versioning belong to this compatibility family.
const LEGACY_GAME_VERSION = '0.2.0.1'
const versionPattern = /^0\.(0|[1-9]\d*)\.0\.([1-9]\d*)$/

/**
 * Owns save compatibility error state and behavior.
 */
export class SaveCompatibilityError extends Error { }

/**
 * Perform assert save compatibility.
 * @param {string | undefined} savedVersion - The saved version supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function assertSaveCompatibility(savedVersion: string | undefined): void {
  const version = savedVersion ?? LEGACY_GAME_VERSION
  if (!versionPattern.test(version) || version.split('.')[1] !== GAME_VERSION.split('.')[1]) {
    throw new SaveCompatibilityError(`Save from version ${version} is incompatible with game ${GAME_VERSION}. Start a new game.`)
  }
}
