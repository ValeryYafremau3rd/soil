import type Phaser from 'phaser'
import type { NpcDefinition } from '../../content/types'
import { cleanNpcFrame } from './cleanNpcFrame'

/**
 * Normalize atlas crops around their authored foot/torso anchors before animation.
 * @param {Scene} scene - Phaser scene that owns rendering and resources.
 * @param {NpcDefinition} definition - The definition supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function prepareNpcTexture(
  scene: Phaser.Scene,
  definition: NpcDefinition
): void {
  if (!definition.frameSize || scene.textures.exists(definition.textureKey)) return

  const source = scene.textures.get(definition.sourceKey).getSourceImage() as HTMLImageElement
  const ratio = source.width / definition.referenceWidth
  const groups = [
    { prefix: '', steps: definition.idleSteps },
    ...(definition.walk ? [{ prefix: `${definition.walk.key}:`, steps: definition.walk.steps }] : []),
    ...(definition.run ? [{ prefix: `${definition.run.key}:`, steps: definition.run.steps }] : []),
    ...(definition.attack ? [{ prefix: `${definition.attack.key}:`, steps: definition.attack.steps }] : []),
    ...(definition.shoot ? [{ prefix: `${definition.shoot.key}:`, steps: definition.shoot.steps }] : []),
    ...(definition.death ? [{ prefix: `${definition.death.key}:`, steps: definition.death.steps }] : [])
  ]
  const steps = groups.flatMap(group => group.steps)
  const size = definition.frameSize
  const texture = scene.textures.createCanvas(definition.textureKey, size.width * steps.length, size.height)
  const scratchKey = `${definition.textureKey}:crop`
  const scratch = scene.textures.createCanvas(
    scratchKey,
    Math.ceil(Math.max(...steps.map(step => step.width))),
    Math.ceil(Math.max(...steps.map(step => step.height)))
  )
  if (!texture || !scratch) throw new Error(`Cannot prepare NPC texture: ${definition.textureKey}`)

  let column = 0

  for (const group of groups) for (const [index, step] of group.steps.entries()) {
    const context = scratch.context
    context.clearRect(0, 0, scratch.width, scratch.height)
    context.drawImage(
      source,
      step.x * ratio,
      step.y * ratio,
      step.width * ratio,
      step.height * ratio,
      0,
      0,
      step.width,
      step.height
    )
    // Authored masks remove atlas labels that touch a pose without trimming its silhouette.
    for (const excluded of step.excludeRegions ?? []) {
      context.clearRect(excluded.x, excluded.y, excluded.width, excluded.height)
    }

    const pixels = context.getImageData(0, 0, step.width, step.height)
    cleanNpcFrame(pixels.data, step.width, step.height, definition)
    context.putImageData(pixels, 0, 0)
    const scale = step.scale ?? 1
    const x = column * size.width
    // Clip to the frame so transparent padding below its anchor cannot spill into another row.
    texture.context.save()
    texture.context.beginPath()
    texture.context.rect(x, 0, size.width, size.height)
    texture.context.clip()
    texture.context.drawImage(
      scratch.canvas,
      0,
      0,
      step.width,
      step.height,
      x + size.width / 2 - (step.anchorX ?? step.width / 2) * scale,
      size.height - (step.anchorY ?? step.height) * scale,
      step.width * scale,
      step.height * scale
    )
    texture.context.restore()
    texture.add(`${group.prefix}${index}`, 0, x, 0, size.width, size.height)
    column++
  }

  scene.textures.remove(scratchKey)
  texture.refresh()
}
