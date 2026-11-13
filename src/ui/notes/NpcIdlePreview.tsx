import { useEffect, useRef } from 'react'
import type { NpcDefinition } from '../../content/types'
import { cleanNpcFrame } from '../../game/rendering/cleanNpcFrame'

/** DOM preview using the same authored crops and cleanup as world NPCs. */
export function NpcIdlePreview({ npc }: { npc: NpcDefinition }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    let disposed = false
    let timer: ReturnType<typeof setInterval> | undefined
    const image = new Image()
    image.onload = () => {
      if (disposed) return
      const size = npc.frameSize ?? {
        width: Math.max(...npc.idleSteps.map(step => step.width)),
        height: Math.max(...npc.idleSteps.map(step => step.height)),
      }
      canvas.width = size.width
      canvas.height = size.height
      const ratio = image.naturalWidth / npc.referenceWidth
      const frames = npc.idleSteps.map(step => {
        const crop = document.createElement('canvas')
        crop.width = step.width
        crop.height = step.height
        const cropContext = crop.getContext('2d')!
        cropContext.drawImage(image, step.x * ratio, step.y * ratio,
          step.width * ratio, step.height * ratio, 0, 0, step.width, step.height)
        const pixels = cropContext.getImageData(0, 0, crop.width, crop.height)
        cleanNpcFrame(pixels.data, crop.width, crop.height, npc)
        cropContext.putImageData(pixels, 0, 0)
        return crop
      })
      let index = 0
      const draw = () => {
        const step = npc.idleSteps[index]
        const scale = step.scale ?? 1
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.drawImage(frames[index], size.width / 2 - (step.anchorX ?? step.width / 2) * scale,
          size.height - (step.anchorY ?? step.height) * scale, step.width * scale, step.height * scale)
        index = (index + 1) % frames.length
      }
      draw()
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && frames.length > 1) {
        timer = setInterval(draw, 1000 / npc.frameRate)
      }
    }
    context.clearRect(0, 0, canvas.width, canvas.height)
    image.src = `${import.meta.env.BASE_URL}${npc.path}`
    return () => { disposed = true; clearInterval(timer) }
  }, [npc])
  return <canvas ref={ref} className="notes-npc-preview" aria-hidden="true" />
}
