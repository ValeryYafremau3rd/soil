import { useEffect, useRef } from 'react'
import { NPCS } from '../../content/npcs'
import { removeEdgeBackground } from '../../game/rendering/removeEdgeBackground'
import './npcPortrait.css'

/**
 * Display a rectangular NPC portrait cropped inside the face sheet's ragged paper edges.
 * @param {{ npcId?: string }} props - Authored NPC identifier; missing portraits render nothing.
 * @returns {Element | null} Accessible portrait cropped to its configured sheet cell.
 */
export function NpcPortrait({ npcId }: { npcId?: string }) {
  const npc = npcId ? NPCS[npcId] : undefined
  const index = npc?.portraitIndex
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || index === undefined || !npc) return

    let disposed = false
    const image = new Image()
    /** Render the selected cell and clear only dark pixels connected to its outer edge. */
    image.onload = () => {
      const context = canvas.getContext('2d')
      if (disposed || !context) return

      const width = image.naturalWidth / 4
      const height = image.naturalHeight / 2
      canvas.width = width
      canvas.height = height
      context.drawImage(image, index % 4 * width, Math.floor(index / 4) * height,
        width, height, 0, 0, width, height)
      const frame = context.getImageData(0, 0, width, height)
      const threshold = npc.portraitBackgroundThreshold
      if (threshold !== undefined) {
        removeEdgeBackground(frame.data, width, height,
          (red, green, blue) => Math.max(red, green, blue) <= threshold)
      }
      context.putImageData(frame, 0, 0)
    }
    image.src = '/assets/characters/npc/faces.png'
    return () => { disposed = true }
  }, [index, npc])
  if (!npc || index === undefined) return null

  return <span className="npc-portrait" role="img" aria-label={`Portrait of ${npc.name}`}>
    <canvas ref={ref} className="npc-portrait__image" aria-hidden="true" />
  </span>
}
