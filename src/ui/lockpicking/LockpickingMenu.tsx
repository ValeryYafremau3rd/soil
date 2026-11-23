import { useEffect, useState, useSyncExternalStore } from 'react'
import type { LockpickingController, LockPuzzle } from '../../app/contracts/lockpicking'
import config from '../../content/ui/lockpicking.json'
import { Modal } from '../components/Modal'
import { LockNumberWheel } from './LockNumberWheel'
import { useLockpickControls } from './useLockpickControls'
import './lockpicking.css'

/**
 * Show the active lock attempt while keeping completion and inventory costs in the service.
 * @param {{ lockpicking: LockpickingController }} props - Observable puzzle actions and state.
 * @returns {import('react').ReactElement | null} Active lock window, or nothing when no attempt is open.
 */
export function LockpickingMenu({ lockpicking }: { lockpicking: LockpickingController }) {
  const { puzzle } = useSyncExternalStore(lockpicking.subscribe, lockpicking.getSnapshot)
  return puzzle ? <LockpickingPuzzle key={puzzle.deadline} lockpicking={lockpicking} puzzle={puzzle} /> : null
}

/**
 * Present a timed mechanical lock with controllable number wheels.
 * @param {{ lockpicking: LockpickingController; puzzle: LockPuzzle }} props - Active attempt and actions.
 * @returns {import('react').ReactElement} Accessible lock controls with target and remaining-time feedback.
 */
function LockpickingPuzzle({ lockpicking, puzzle }: {
  lockpicking: LockpickingController
  puzzle: LockPuzzle
}) {
  const [started] = useState(Date.now)
  const [now, setNow] = useState(started)
  const { selected, setSelected, numbers, onKeyDown } = useLockpickControls(lockpicking, puzzle)
  useEffect(() => {
    const timer = window.setInterval(() => {
      lockpicking.tick()
      setNow(Date.now())
    }, config.tickMs)
    return () => window.clearInterval(timer)
  }, [lockpicking])
  const remaining = Math.max(0, puzzle.deadline - now)
  const duration = Math.max(1, puzzle.deadline - started)
  const sum = puzzle.numbers.reduce((total, value) => total + value, 0)

  return <Modal title={config.title} onClose={lockpicking.close} className="lock-modal">
    <div className="lock-workbench" onKeyDown={onKeyDown}>
      <header className="lock-heading">
        <span className="lock-eyebrow">Lockpicking / {puzzle.name}</span>
        <h3>Find the combination</h3>
        <p>{config.instructions}</p>
        <button className="lock-close" type="button" aria-label="Close lockpicking"
          onClick={lockpicking.close}>×</button>
      </header>
      <div className="lock-mechanism">
        <div className="lock-shackle" aria-hidden="true" />
        <div className="lock-body">
          <span className="lock-engraving" aria-hidden="true">SECURITY · SERIES III</span>
          <div className="lock-target">Target sum <strong>{puzzle.target}</strong></div>
          <div className="lock-dial-bank" role="group" aria-label="Combination wheels">
            {puzzle.numbers.map((value, index) => <LockNumberWheel key={index}
              index={index} value={value} selected={selected === index}
              inputRef={element => { numbers.current[index] = element }}
              onSelect={setSelected} onChange={lockpicking.setNumber} />)}
          </div>
          <div className="lock-readout" aria-live="polite">
            <span>Current sum <strong>{sum}</strong></span>
            <span>{sum === puzzle.target ? 'Aligned — try the lock' : 'Turn to align'}</span>
          </div>
          <i className="lock-rivet lock-rivet--left" aria-hidden="true" />
          <i className="lock-rivet lock-rivet--right" aria-hidden="true" />
        </div>
      </div>
      <div className="lock-time-label"><span>Time remaining</span><strong>{(remaining / 1000).toFixed(1)}s</strong></div>
      <progress className="lock-timer" aria-label="Lockpicking time remaining"
        value={remaining} max={duration} />
      <button className="lock-submit" type="button" onClick={lockpicking.submit}>{config.submitLabel}</button>
      <p className="lock-controls">{config.controls}</p>
    </div>
  </Modal>
}
