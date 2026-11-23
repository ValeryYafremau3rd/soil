import { useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'
import config from '../../content/ui/lockpicking.json'

/**
 * Bind physical wheel/swipe gestures and animate digit changes without owning puzzle rules.
 * @param {number} value - Current displayed digit from the puzzle service.
 * @param {(direction: number) => void} onStep - Typed input adapter for one signed wheel step.
 * @returns {object} Wheel/reel refs and pointer handlers with automatic listener cleanup.
 */
export function useLockWheel(value: number, onStep: (direction: number) => void) {
  const wheel = useRef<HTMLDivElement>(null)
  const reel = useRef<HTMLDivElement>(null)
  const previous = useRef(value)
  const pointerY = useRef<number | null>(null)
  const lastWheel = useRef(0)

  useEffect(() => {
    const element = wheel.current
    if (!element) return

    /**
     * Consume scrolling inside the wheel rather than scrolling the modal or page.
     * @param {WheelEvent} event - Native wheel input, registered as non-passive.
     * @returns {void} Rotates one digit at the configured repeat interval.
     */
    function scroll(event: WheelEvent): void {
      event.preventDefault()
      if (!event.deltaY || performance.now() - lastWheel.current < config.wheelStepIntervalMs) return
      lastWheel.current = performance.now()
      element?.querySelector<HTMLButtonElement>('[role="spinbutton"]')?.focus()
      onStep(event.deltaY > 0 ? 1 : -1)
    }

    element.addEventListener('wheel', scroll, { passive: false })
    return () => element.removeEventListener('wheel', scroll)
  }, [onStep])

  useEffect(() => {
    const oldValue = previous.current
    previous.current = value
    if (oldValue === value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const increasing = value === oldValue % 9 + 1
    const animation = reel.current?.animate([
      { transform: `translateY(${increasing ? 1 : -1}em)` },
      { transform: 'translateY(0)' },
    ], { duration: config.wheelTransitionMs, easing: 'ease-out' })
    return () => animation?.cancel()
  }, [value])

  /**
   * Capture a primary pointer so touch scrolling becomes a wheel gesture.
   * @param {PointerEvent<HTMLButtonElement>} event - Pointer pressed on the digit window.
   * @returns {void} Records the gesture origin without changing the digit.
   */
  function onPointerDown(event: PointerEvent<HTMLButtonElement>): void {
    if (event.button !== 0) return
    pointerY.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  /**
   * Commit one wheel step when a swipe exceeds the authored threshold.
   * @param {PointerEvent<HTMLButtonElement>} event - Released or cancelled pointer.
   * @returns {void} Resets gesture state and optionally rotates the digit.
   */
  function onPointerUp(event: PointerEvent<HTMLButtonElement>): void {
    const start = pointerY.current
    pointerY.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (start === null || event.type === 'pointercancel') return
    const distance = start - event.clientY
    if (Math.abs(distance) >= config.swipeThresholdPx) onStep(distance > 0 ? 1 : -1)
  }

  return { wheel, reel, onPointerDown, onPointerUp }
}
