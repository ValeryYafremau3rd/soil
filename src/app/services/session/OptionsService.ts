import type { OptionsController, PlayerPosition, SaveGame, SaveStorage } from '../../contracts/save'
import { SaveCompatibilityError } from '../../version.ts'

/**
 * Owns options service state and behavior.
 */
export class OptionsService implements OptionsController {
  private readonly storage: SaveStorage
  private readonly capture: (position: PlayerPosition) => SaveGame | null
  private readonly validate: (value: unknown) => SaveGame
  private readonly onLoad: (save: SaveGame) => void
  private readonly onRestart: () => void
  private readonly onExit: () => void
  private readonly notify: (text: string) => void
  private position: PlayerPosition | null = null
  private loadedPosition: PlayerPosition | null
  private readonly difficulty?: {
    ids: readonly string[]
    getId: () => string
    select: (id: string) => void
  }

  /**
   * Read the selected challenge for options controls.
   * @returns {string} Current authored difficulty identifier.
   */
  getDifficulty = (): string => this.difficulty?.getId() ?? ''

  /**
   * Apply a challenge selection while preserving the current session and save slot.
   * @param {string} id - Authored difficulty identifier to validate and apply.
   * @returns {void} Reloads playable state, or updates the pending character setup.
   */
  changeDifficulty = (id: string): void => {
    if (!this.difficulty?.ids.includes(id) || id === this.getDifficulty()) return

    if (!this.position) {
      this.difficulty.select(id)
      return
    }

    const save = this.capture(this.position)
    if (!save) return

    this.onLoad(this.validate({ ...save, difficultyId: id }))
  }

  /**
   * Initialize the OptionsService instance and its collaborators.
   * @param {SaveStorage} storage - The storage supplied to this operation.
   * @param {(position: PlayerPosition) => SaveGame | null} capture - The capture supplied to this operation.
   * @param {(value: unknown) => SaveGame} validate - The validate supplied to this operation.
   * @param {(save: SaveGame) => void} onLoad - The on load supplied to this operation.
   * @param {() => void} onRestart - The on restart supplied to this operation.
   * @param {(text: string) => void} notify - Callback for presenting an operation message.
   * @param {PlayerPosition | null} loadedPosition - The loaded position supplied to this operation.
   * @param {() => void} onExit - The on exit supplied to this operation.
   * @param {object} difficulty - Optional authored choices and pending setup accessors.
   * @returns {OptionsService} The initialized instance.
   */
  constructor(
    storage: SaveStorage,
    capture: (position: PlayerPosition) => SaveGame | null,
    validate: (value: unknown) => SaveGame,
    onLoad: (save: SaveGame) => void,
    onRestart: () => void,
    notify: (text: string) => void,
    loadedPosition: PlayerPosition | null = null,
    onExit: () => void = () => { },
    difficulty?: {
      ids: readonly string[]
      getId: () => string
      select: (id: string) => void
    }
  ) {
    this.storage = storage
    this.difficulty = difficulty
    this.capture = capture
    this.validate = validate
    this.onLoad = onLoad
    this.onRestart = onRestart
    this.notify = notify
    this.loadedPosition = loadedPosition
    this.onExit = onExit
  }

  /**
   * Update position.
   * @param {PlayerPosition} position - The position supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  updatePosition = (position: PlayerPosition): void => {
    this.position = { ...position }
  }

  /**
   * Perform take loaded position for OptionsService.
   * @returns {PlayerPosition | null} The result described by the TypeScript return signature.
   */
  takeLoadedPosition = (): PlayerPosition | null => {
    const position = this.loadedPosition
    this.loadedPosition = null

    return position
  }

  /**
   * Perform save for OptionsService.
   * @returns {void} Completes the operation without returning a value.
   */
  save = (): void => {
    try {
      const save = this.position && this.capture(this.position)
      if (!save) {
        this.notify('The game is not ready to save yet.')

        return
      }

      this.validate(save)
      this.storage.write(JSON.stringify(save))
      this.notify('Game saved.')
    } catch {
      this.notify('Unable to save the game. Check browser storage availability.')
    }
  }

  /**
   * Perform load for OptionsService.
   * @returns {void} Completes the operation without returning a value.
   */
  load = (): void => {
    try {
      const raw = this.storage.read()
      if (!raw) {
        this.notify('No saved game found.')

        return
      }

      const save = this.validate(JSON.parse(raw))
      this.onLoad(save)
    } catch (error) {
      this.notify(error instanceof SaveCompatibilityError ? error.message : 'Unable to load this save. It may be damaged or incompatible.')
    }
  }

  /**
   * Perform restart for OptionsService.
   * @returns {void} Completes the operation without returning a value.
   */
  restart = (): void => {
    this.onRestart()
  }

  /**
   * Perform exit for OptionsService.
   * @returns {void} Completes the operation without returning a value.
   */
  exit = (): void => {
    this.onExit()
  }
}
