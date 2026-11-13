import type { OptionsController, PlayerPosition, SaveGame, SaveStorage } from '../contracts/save'
import { SaveCompatibilityError } from '../version.ts'

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

  constructor(storage: SaveStorage, capture: (position: PlayerPosition) => SaveGame | null, validate: (value: unknown) => SaveGame,
    onLoad: (save: SaveGame) => void, onRestart: () => void, notify: (text: string) => void, loadedPosition: PlayerPosition | null = null,
    onExit: () => void = () => {}) {
    this.storage = storage; this.capture = capture; this.validate = validate
    this.onLoad = onLoad; this.onRestart = onRestart; this.notify = notify; this.loadedPosition = loadedPosition
    this.onExit = onExit
  }
  updatePosition = (position: PlayerPosition): void => { this.position = { ...position } }
  takeLoadedPosition = (): PlayerPosition | null => {
    const position = this.loadedPosition
    this.loadedPosition = null
    return position
  }
  save = (): void => {
    try {
      const save = this.position && this.capture(this.position)
      if (!save) { this.notify('The game is not ready to save yet.'); return }
      this.validate(save)
      this.storage.write(JSON.stringify(save))
      this.notify('Game saved.')
    } catch { this.notify('Unable to save the game. Check browser storage availability.') }
  }
  load = (): void => {
    try {
      const raw = this.storage.read()
      if (!raw) { this.notify('No saved game found.'); return }
      const save = this.validate(JSON.parse(raw))
      this.onLoad(save)
    } catch (error) { this.notify(error instanceof SaveCompatibilityError ? error.message : 'Unable to load this save. It may be damaged or incompatible.') }
  }
  restart = (): void => { this.onRestart() }
  exit = (): void => { this.onExit() }
}
