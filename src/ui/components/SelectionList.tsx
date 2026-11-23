import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { selectionIndex } from './selection'
import { menuAction } from '../../platform/ui/menuNavigation'

/**
 * Selectable list entry rendered by the shared selection component.
 */
interface SelectionItem {
  id: string
  label: string
  visited?: boolean
  detail?: string
  icon?: ReactNode
}

/**
 * Items, selection and event callbacks supplied to the selection list.
 */
interface SelectionListProps {
  label: string
  items: readonly SelectionItem[]
  onChoose: (id: string) => void
  wrap?: boolean
}

/**
 * Perform selection list.
 * @param {SelectionListProps} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function SelectionList({ label, items, onChoose, wrap = true }: SelectionListProps) {
  const [selection, setSelection] = useState(0)
  const id = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const active = Math.min(selection, items.length - 1)
  const activeId = items[active]?.id

  useLayoutEffect(
    () => {
      listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    },
    [active, activeId, items]
  )

  /**
   * Perform handle key down.
   * @param {KeyboardEvent<HTMLUListElement>} event - The event supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLUListElement>): void {
    const action = menuAction(event)
    if (action === 'up' || action === 'down' || action === 'first' || action === 'last') {
      event.preventDefault()
      event.stopPropagation()
      setSelection(selectionIndex(active, items.length, action, wrap))
    } else if (action === 'choose') {
      event.preventDefault()
      event.stopPropagation()
      if (!event.repeat && items[active]) onChoose(items[active].id)
    }
  }

  return <ul ref={listRef} className="selection-list" role="listbox" aria-label={label}
    tabIndex={0} data-autofocus aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
    onKeyDown={handleKeyDown}>
    {items.map((
      item,
      index
    ) => <li key={item.id} id={`${id}-${index}`} role="option"
      aria-selected={index === active} className="selection-list__option" data-visited={item.visited || undefined}
      onMouseEnter={() => setSelection(index)} onClick={() => onChoose(item.id)}>
        <span aria-hidden="true" className="selection-list__marker">{index === active ? '›' : ''}</span>
        {item.icon}
        <span>{item.label}</span>
        {item.detail && <small>{item.detail}</small>}
      </li>)}
  </ul>
}
