import type { NpcDefinition } from '../../content/types'
import { removeEdgeBackground } from './removeEdgeBackground'
import { keepLargestComponent } from './keepLargestComponent'

export function cleanNpcFrame(data: Uint8ClampedArray, width: number, height: number, definition: NpcDefinition): void {
  if (definition.backgroundThreshold !== undefined) {
    const threshold = definition.backgroundThreshold
    removeEdgeBackground(data, width, height, (red, green, blue) => Math.max(red, green, blue) <= threshold
      && (definition.backgroundMinGreenRed === undefined || green - red >= definition.backgroundMinGreenRed))
  } else if (definition.background !== 'none') {
    removeEdgeBackground(data, width, height, definition.background ?? 'light')
  }
  if (definition.keepLargestComponent) keepLargestComponent(data, width, height)
}
