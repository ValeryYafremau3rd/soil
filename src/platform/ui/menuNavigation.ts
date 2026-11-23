import keys from '../../content/ui/selection-keys.json' with { type: 'json' }
import { isModifiedOrComposing } from './isModifiedOrComposing.ts'

export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'first' | 'last' | 'choose'
type KeyEvent = Parameters<typeof isModifiedOrComposing>[0] & {
  key: string
  defaultPrevented: boolean
}

/**
 * Decode input without choosing a menu action or interfering with text editing.
 * @param {KeyEvent} event - The event supplied to this operation.
 * @returns {MenuAction | undefined} The result described by the TypeScript return signature.
 */
export function menuAction(event: KeyEvent): MenuAction | undefined {
  if (event.defaultPrevented || isModifiedOrComposing(event)) return

  const key = event.key.toLowerCase()

  for (const action of ['up', 'down', 'left', 'right', 'choose'] as const) {
    if (keys[action].includes(key)) return action
  }

  if (key === 'home') return 'first'

  if (key === 'end') return 'last'
}
