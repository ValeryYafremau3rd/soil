import { useCallback } from 'react'
import type { Ref } from 'react'
import { rotateLockDigit } from './lockWheelInput'
import { useLockWheel } from './useLockWheel'

/** One accessible wheel controlled entirely by the lockpicking service. */
interface LockNumberWheelProps {
  index: number
  value: number
  selected: boolean
  inputRef: Ref<HTMLButtonElement>
  onSelect(index: number): void
  onChange(index: number, value: number): void
}

/**
 * Render a recessed mechanical digit drum with buttons, scrolling and swipe input.
 * @param {LockNumberWheelProps} props - Digit value, selection and typed input callbacks.
 * @returns {import('react').ReactElement} Focusable spinbutton with decorative neighboring digits.
 */
export function LockNumberWheel({
  index, value, selected, inputRef, onSelect, onChange,
}: LockNumberWheelProps) {
  const step = useCallback((direction: number) => {
    onSelect(index)
    onChange(index, rotateLockDigit(value, direction))
  }, [index, value, onSelect, onChange])
  const { wheel, reel, onPointerDown, onPointerUp } = useLockWheel(value, step)

  return <div ref={wheel} className={`lock-wheel${selected ? ' is-selected' : ''}`}>
    <button className="lock-wheel__turn" type="button" tabIndex={-1}
      aria-label={`Decrease number ${index + 1}`} onClick={() => step(-1)}>▴</button>
    <button type="button" ref={inputRef} role="spinbutton" className="lock-wheel__window"
      aria-label={`Number ${index + 1}`} aria-valuemin={1} aria-valuemax={9} aria-valuenow={value}
      data-autofocus={index === 0 ? true : undefined} tabIndex={selected ? 0 : -1}
      onFocus={() => onSelect(index)} onClick={() => onSelect(index)}
      onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div ref={reel} className="lock-wheel__reel" aria-hidden="true">
        <span>{rotateLockDigit(value, -1)}</span>
        <strong>{value}</strong>
        <span>{rotateLockDigit(value, 1)}</span>
      </div>
    </button>
    <button className="lock-wheel__turn" type="button" tabIndex={-1}
      aria-label={`Increase number ${index + 1}`} onClick={() => step(1)}>▾</button>
  </div>
}
