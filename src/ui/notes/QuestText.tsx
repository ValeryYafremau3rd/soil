import { Fragment } from 'react'
import { ITEM_BY_ID } from '../../content/items'
import { LOCATIONS } from '../../content/locations'
import { NPCS } from '../../content/npcs'

export type NoteTarget = { category: 'people' | 'items' | 'locations'; id: string }
type Reference = NoteTarget & { name: string }
const references: Reference[] = [
  ...Object.entries(NPCS).map(([id, npc]) => ({ category: 'people' as const, id, name: npc.name })),
  ...Object.entries(ITEM_BY_ID).map(([id, item]) => ({ category: 'items' as const, id, name: item.name })),
  ...LOCATIONS.map(location => ({ category: 'locations' as const, id: location.id, name: location.name })),
].sort((a, b) => b.name.length - a.name.length)
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Longest names win, and word boundaries prevent matching an item inside another word.
const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(${references.map(entry => escape(entry.name)).join('|')})(?![\\p{L}\\p{N}_])`, 'giu')

export function QuestText({ text, onOpenNote }: { text: string; onOpenNote: (target: NoteTarget) => void }) {
  return text.split(pattern).map((part, index) => {
    const entry = index % 2 ? references.find(reference => reference.name.toLowerCase() === part.toLowerCase()) : undefined
    return entry ? <a className="quest-note-link" href={`#notes/${entry.category}/${entry.id}`} key={index}
      onClick={event => { event.preventDefault(); onOpenNote({ category: entry.category, id: entry.id }) }}>{part}</a>
      : <Fragment key={index}>{part}</Fragment>
  })
}
