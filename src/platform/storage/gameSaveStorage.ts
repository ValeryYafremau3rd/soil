import type { SaveStorage } from '../../app/contracts/save'

const SAVE_KEY = 'soil-game.save.v1'
/** Browser storage stays behind this adapter so wrappers can replace it later. */
export const gameSaveStorage: SaveStorage = {
  read: () => window.localStorage.getItem(SAVE_KEY),
  write: value => window.localStorage.setItem(SAVE_KEY, value),
}
