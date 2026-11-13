import { NPCS } from "../../content/npcs";
import "./notes.css";
import { NpcIdlePreview } from './NpcIdlePreview';
export function PersonNote({ id }: { id: string }) {
const npc = NPCS[id],
      dialogue = npc.dialogue;
return (
      <>
        <NpcIdlePreview key={id} npc={npc} />
        <h3>{npc.name}</h3>
        {(dialogue?.barter || !!dialogue?.barters?.length) && <p>Barter available</p>}
        {dialogue && <p>{dialogue.nodes[dialogue.start].text}</p>}
        {dialogue?.nodes.about && <p>{dialogue.nodes.about.text}</p>}
      </>
    );
}
