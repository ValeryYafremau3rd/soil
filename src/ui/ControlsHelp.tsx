import { UI_CONFIG } from '../content/ui'
export function ControlsHelp() {
  return <p className="controls-help">{UI_CONFIG.controls.map((control, index) =>
    <span key={control.key}>{index > 0 ? '   ' : ''}{control.key} · {control.label}</span>)}</p>
}
