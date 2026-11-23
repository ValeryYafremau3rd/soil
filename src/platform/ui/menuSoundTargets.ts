import { menuAction } from './menuNavigation.ts'

export const MODAL_SELECTOR = 'dialog[open], [role="dialog"]'
const CONTROL_SELECTOR = 'button, a[href], input, select, textarea, summary, '
  + '[role="option"], [role="tab"], [role="button"], [role="spinbutton"], label'

/**
 * Resolve an enabled UI control, including clicks on its nested icon or label.
 * @param {EventTarget | null} target - Native input target; canvas input is excluded.
 * @returns {Element | null} Enabled control that owns the interaction, if any.
 */
export function menuSoundControl(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null

  const control = target.closest(CONTROL_SELECTOR)
  return control?.closest(':disabled, [aria-disabled="true"]') ? null : control
}

/**
 * Recognize menu keys without treating text entry or gameplay movement as UI actions.
 * @param {KeyboardEvent} event - Native key before React consumes its menu action.
 * @param {Document} document - Owning document used to find the active modal.
 * @returns {boolean} Whether this press should use the shared modal sound.
 */
export function isMenuSoundKey(event: KeyboardEvent, document: Document): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return false
  if (!document.querySelector(MODAL_SELECTOR)) return false

  const target = event.target instanceof Element ? event.target : null
  if (target?.closest(':disabled, [aria-disabled="true"]')) return false
  if (event.key === 'Tab' || event.key === 'Escape') return !event.repeat

  if (target?.closest('input:not([type="radio"]):not([type="checkbox"]):not([type="range"]), '
    + 'textarea, [contenteditable="true"]')) return false

  const action = menuAction({
    key: event.key, defaultPrevented: event.defaultPrevented,
    altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey,
    nativeEvent: event,
  })
  return Boolean(action && !(action === 'choose' && event.repeat))
}
