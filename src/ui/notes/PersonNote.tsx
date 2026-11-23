import { NPCS } from "../../content/npcs"
import "./notes.css"
import { NpcPortrait } from '../components/NpcPortrait'

/**
 * Perform person note.
 * @param {{ id: string }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function PersonNote({ id }: {
  id: string
}) {
  const npc = NPCS[id],
    dialogue = npc.dialogue

  return (
    <>
      <h3>{npc.name}</h3>
      <NpcPortrait npcId={id} />
      {(dialogue?.barter || !!dialogue?.barters?.length) && <p>Barter available</p>}
      {dialogue && <p>{dialogue.nodes[dialogue.start].text}</p>}
      {dialogue?.nodes.about && <p>{dialogue.nodes.about.text}</p>}
    </>
  )
}
