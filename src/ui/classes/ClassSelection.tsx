import { menuAction } from '../../platform/ui/menuNavigation'
import { selectionIndex } from '../components/selection'
import { useRef, useState } from "react"
import { CLASSES } from "../../content/classes"
import { ITEM_BY_ID } from "../../content/items"
import { difficultyRules } from '../../content/difficulty'
import { attributeVitals } from '../../domain/skills/vitals'
import {
  createCharacter,
} from "../../domain/skills/character"
import {
  VITAL_LABELS,
  understandsItem,
  itemRequirementStates,
  activeBonusItems,
  applyCarriedBonuses
} from "../../domain/inventory/items"
import { ItemRequirements } from '../inventory/ItemRequirements'
import { ItemBonusText } from '../inventory/ItemBonusText'
import type { Vital } from "../../domain/inventory/items"
import { useModalDialog } from "../../platform/ui/useModalDialog"
import { CharacterDetails } from "../character/CharacterDetails"
import { Button } from "../components/Button"
import { ItemIcon } from "../inventory/ItemIcon"
import "../components/components.css"
import "../inventory/inventory.css"
import "../components/dossier.css"
import "./classes.css"

/**
 * Perform class selection.
 * @param {{ onSelect: (classId: string) => void }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function ClassSelection({
  onSelect,
}: {
  onSelect: (classId: string) => void
}) {
  const [index, setIndex] = useState(0)
  const ref = useModalDialog()
  const submitted = useRef(false)
  const definition = CLASSES[index]
  const character = applyCarriedBonuses(
    createCharacter(definition),
    activeBonusItems(
      definition.startingItems.map(itemId => ({ itemId, quantity: definition.startingItemQuantities?.[itemId] ?? 1 })),
      {},
      ITEM_BY_ID
    ),
    ITEM_BY_ID,
  )
  const vitals = attributeVitals(difficultyRules().stats, character.attributes)

  return (
    <dialog
      ref={ref}
      className="ui-modal dossier-modal class-selection"
      aria-labelledby="class-selection-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") event.preventDefault()
      }}
      onKeyDownCapture={(event) => {
        const action = menuAction(event)
        if (action === 'choose') {
          event.preventDefault()
          event.stopPropagation()
          if (!event.repeat) ref.current?.querySelector('form')?.requestSubmit()

          return
        }

        if (!action || action === 'up' || action === 'down') return

        const next = selectionIndex(index, CLASSES.length, action)
        event.preventDefault()
        event.stopPropagation()
        setIndex(next)
        ref.current
          ?.querySelector<HTMLElement>(`#class-tab-${CLASSES[next].id}`)
          ?.focus()
      }}
      onCancel={(event) => event.preventDefault()}
    >
      <form
        className="ui-panel"
        onSubmit={(event) => {
          event.preventDefault()
          if (submitted.current) return

          submitted.current = true
          onSelect(definition.id)
        }}
      >
        <header>
          <div className="class-selection__heading">
            <h1 id="class-selection-title">Choose your class</h1>
            <Button type="submit">Play as {definition.name}</Button>
          </div>
          <p>
            Your background determines your attributes, skills, and starting
            equipment.
          </p>
        </header>
        <div
          className="class-selection__tabs"
          role="tablist"
          aria-label="Classes"
        >
          {CLASSES.map((entry, tabIndex) => (
            <button
              type="button"
              role="tab"
              key={entry.id}
              id={`class-tab-${entry.id}`}
              aria-selected={index === tabIndex}
              aria-controls="class-panel"
              tabIndex={index === tabIndex ? 0 : -1}
              data-autofocus={index === tabIndex ? true : undefined}
              onClick={() => setIndex(tabIndex)}
            >
              {entry.name}
            </button>
          ))}
        </div>
        <section
          id="class-panel"
          role="tabpanel"
          aria-labelledby={`class-tab-${definition.id}`}
          tabIndex={0}
        >
          <dl className="class-selection__vitals" aria-label="Starting vitals" aria-live="polite">
            {vitals.map(stat => <div key={stat.id}>
              <dt>{VITAL_LABELS[stat.id]}</dt>
              <dd>{stat.value}</dd>
            </div>)}
          </dl>
          <CharacterDetails character={character}>
            <section>
              <h3>Starting items</h3>
              <ul className="class-selection__items">
                {definition.startingItems.map((id) => {
                  const item = ITEM_BY_ID[id]
                  const skills = character.skills
                  const known = understandsItem(item, skills.erudition, skills)
                  const recovery = Object.entries(item.recovery ?? {}) as [
                    Vital,
                    number,
                  ][]

                  return (
                    <li key={id}>
                      <ItemIcon itemId={id} />
                      <span>
                        {item.name}
                        {(definition.startingItemQuantities?.[id] ?? 1) > 1 && ` ×${definition.startingItemQuantities![id]}`}
                        {(!known || item.requirementMode === 'any') && <ItemRequirements requirements={itemRequirementStates(item, skills)} />}
                        {known && <>
                          {(item.bonus || item.bonuses?.length) && (
                            <small className="class-selection__item-effect">
                              <ItemBonusText item={item} />
                            </small>
                          )}
                          {!!item.stealthModifier && <small className="class-selection__item-effect">{item.stealthModifier > 0 ? '+' : ''}{item.stealthModifier} Stealth</small>}
                          {!!item.damageResistance && <small className="class-selection__item-effect">+{item.damageResistance}% Damage resistance</small>}
                          {!!item.fearResistance && <small className="class-selection__item-effect">+{item.fearResistance}% Fear resistance</small>}
                          {recovery.length > 0 && (
                            <small className="class-selection__item-effect">
                              On use:{" "}
                              {recovery
                                .map(
                                  ([key, amount]) =>
                                    `+${amount} ${VITAL_LABELS[key]}`,
                                )
                                .join(", ")}
                            </small>
                          )}
                        </>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          </CharacterDetails>
        </section>
      </form>
    </dialog>
  )
}
