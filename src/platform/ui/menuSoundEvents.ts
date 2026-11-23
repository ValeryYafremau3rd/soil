import type { AudioController } from '../../app/contracts/audio'
import { isMenuSoundKey, menuSoundControl, MODAL_SELECTOR } from './menuSoundTargets.ts'

/**
 * Sound activation of an enabled UI control or a modal's dismissible backdrop.
 * @param {Event} event - Click or native control change, including nested icon targets.
 * @param {Pick<AudioController, 'cue'>} audio - Shared service playback capability.
 * @returns {void} Requests the same cue used by window transitions.
 */
export function soundMenuActivation(event: Event, audio: Pick<AudioController, 'cue'>): void {
  const backdrop = event.target instanceof Element
    && event.target.matches('dialog[open], .ui-modal-backdrop')
  if (menuSoundControl(event.target) || backdrop) audio.cue('ui')
}

/**
 * Sound menu navigation before listeners consume it, without duplicating native clicks.
 * @param {KeyboardEvent} event - Capture-phase key press.
 * @param {Document} document - Owning document used to find the active modal.
 * @param {Pick<AudioController, 'cue'>} audio - Shared service playback capability.
 * @returns {void} Leaves input handling with the existing menus.
 */
export function soundMenuNavigation(
  event: KeyboardEvent,
  document: Document,
  audio: Pick<AudioController, 'cue'>,
): void {
  if (!isMenuSoundKey(event, document)) return

  if (event.key === 'Enter' || event.key === ' ') {
    // Native controls sound on click; custom menus prevent that click and act on keydown.
    // A task boundary is required: native capture listeners can flush microtasks early.
    setTimeout(() => { if (event.defaultPrevented) audio.cue('ui') }, 0)
  } else audio.cue('ui')
}

/**
 * Sound pointer selection when entering a different dialogue or menu option.
 * @param {MouseEvent} event - Movement between option rows or their nested children.
 * @param {Pick<AudioController, 'cue'>} audio - Shared service playback capability.
 * @returns {void} Ignores movement inside an already selected option.
 */
export function soundMenuSelection(event: MouseEvent, audio: Pick<AudioController, 'cue'>): void {
  const option = menuSoundControl(event.target)?.closest('[role="option"]')
  if (!option?.closest(MODAL_SELECTOR) || option.getAttribute('aria-selected') === 'true') return
  if (event.relatedTarget instanceof Node && option.contains(event.relatedTarget)) return

  audio.cue('ui')
}

/**
 * Sound wheel and touch gestures only after an accessible digit value changes.
 * @param {MutationRecord[]} records - Batched lock-control attribute updates.
 * @param {Pick<AudioController, 'cue'>} audio - Shared service playback capability.
 * @returns {void} Ignores timer text, animation and unchanged values.
 */
export function soundMenuWheel(
  records: MutationRecord[],
  audio: Pick<AudioController, 'cue'>,
): void {
  if (records.some(record => record.target instanceof Element
    && record.target.matches('[role="spinbutton"]')
    && record.target.closest(MODAL_SELECTOR)
    && record.oldValue !== record.target.getAttribute('aria-valuenow'))) audio.cue('ui')
}
