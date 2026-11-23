import { UI_CONFIG } from '../content/ui'

/**
 * Perform controls help.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function ControlsHelp() {
  return <p className="controls-help">{UI_CONFIG.controls.map((control, index) =>
    <span key={control.key}>{index > 0 ? '   ' : ''}{control.key} · {control.label}</span>)}</p>
}
