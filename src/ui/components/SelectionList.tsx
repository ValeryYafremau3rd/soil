import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { moveSelection } from './selection'
import { UI_CONFIG } from '../../content/ui'

interface SelectionItem {
  id: string
  label: string
  detail?: string
  icon?: ReactNode
}

interface SelectionListProps {
  label: string
  items: readonly SelectionItem[]
  onChoose: (id: string) => void
  wrap?: boolean
}

export function SelectionList({ label, items, onChoose, wrap = true }: SelectionListProps) {
  const [selection, setSelection] = useState(0)
  const id = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const active = Math.min(selection, items.length - 1)
  const activeId = items[active]?.id

  useLayoutEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [active, activeId, items])

  function handleKeyDown(event: KeyboardEvent<HTMLUListElement>): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const key = event.key.toLowerCase()
    const keys = UI_CONFIG.selectionKeys
    if (keys.up.includes(key) || keys.down.includes(key)) {
      event.preventDefault()
      const direction = keys.up.includes(key) ? -1 : 1
      setSelection(wrap ? moveSelection(active, items.length, direction) : Math.max(0, Math.min(items.length - 1, active + direction)))
    } else if (keys.choose.includes(key)) {
      event.preventDefault()
      if (!event.repeat && items[active]) onChoose(items[active].id)
    }
  }

  return <ul ref={listRef} className="selection-list" role="listbox" aria-label={label}
    tabIndex={0} data-autofocus aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
    onKeyDown={handleKeyDown}>
    {items.map((item, index) => <li key={item.id} id={`${id}-${index}`} role="option"
      aria-selected={index === active} className="selection-list__option"
      onMouseEnter={() => setSelection(index)} onClick={() => onChoose(item.id)}>
      <span aria-hidden="true" className="selection-list__marker">{index === active ? '›' : ''}</span>
      {item.icon}
      <span>{item.label}</span>
      {item.detail && <small>{item.detail}</small>}
    </li>)}
  </ul>
}
