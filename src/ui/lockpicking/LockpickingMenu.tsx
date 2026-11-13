import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { LockpickingController, LockPuzzle } from '../../app/contracts/lockpicking'
import { Modal } from '../components/Modal'
import './lockpicking.css'

export function LockpickingMenu({ lockpicking }: { lockpicking: LockpickingController }) {
  const { puzzle } = useSyncExternalStore(lockpicking.subscribe, lockpicking.getSnapshot)
  return puzzle ? <LockpickingPuzzle key={puzzle.deadline} lockpicking={lockpicking} puzzle={puzzle} /> : null
}

function LockpickingPuzzle({ lockpicking, puzzle }: { lockpicking: LockpickingController; puzzle: LockPuzzle }) {
  const [started] = useState(Date.now)
  const [now, setNow] = useState(started)
  const [selected, setSelected] = useState(0)
  const numbers = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    const timer = window.setInterval(() => { lockpicking.tick(); setNow(Date.now()) }, 50)
    return () => window.clearInterval(timer)
  }, [lockpicking])
  const remaining = Math.max(0, Math.min(100, (puzzle.deadline - now) / Math.max(1, puzzle.deadline - started) * 100))
  return <Modal title={'Lockpick ' + puzzle.name} onClose={lockpicking.close} className="lock-modal">
    <div onKeyDown={event => {
      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        if (!event.repeat && !event.nativeEvent.isComposing) lockpicking.submit()
        return
      }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const next = (selected + (event.key === 'ArrowRight' ? 1 : 2)) % 3
        setSelected(next)
        numbers.current[next]?.focus()
      } else {
        const value = (puzzle.numbers[selected] - 1 + (event.key === 'ArrowUp' ? 1 : 8)) % 9 + 1
        lockpicking.setNumber(selected, value)
      }
    }}>
      <div className="lock-timer" role="progressbar" aria-label="Lockpicking time remaining" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(remaining)}>
        <div className="lock-timer__fill" style={{ width: remaining + '%' }} />
      </div>
      <div className="lock-sum" aria-live="polite">
        <span>Target sum</span>
        <strong>{puzzle.target}</strong>
        <small>Enter to confirm</small>
      </div>
      <div className="lock-numbers">{puzzle.numbers.map((value, index) => <button key={index} type="button"
        ref={element => { numbers.current[index] = element }}
        role="spinbutton" aria-label={'Number ' + (index + 1)} aria-valuemin={1} aria-valuemax={9} aria-valuenow={value}
        data-autofocus={index === 0 ? true : undefined} tabIndex={selected === index ? 0 : -1}
        className={selected === index ? 'is-selected' : ''} onFocus={() => setSelected(index)} onClick={() => setSelected(index)}>
        {value}
      </button>)}</div>
    </div>
  </Modal>
}
