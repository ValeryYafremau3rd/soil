import type { Platform } from '../../domain/movement/platforms'
import type { SurfaceDefinition } from '../../content/types'

export function worldSurfaces(id: string, bounds: { x: number; y: number; width: number; height: number }, definitions: readonly SurfaceDefinition[] = []): Platform[] {
  return definitions.map((surface, index) => ({
    id: `${id}:${index}`, left: bounds.x + surface.left * bounds.width,
    right: bounds.x + surface.right * bounds.width, y: bounds.y + surface.top * bounds.height,
    ...(surface.bottom === undefined ? {} : { bottom: bounds.y + surface.bottom * bounds.height }),
    ...(surface.rightTop === undefined ? {} : { rightY: bounds.y + surface.rightTop * bounds.height }),
  }))
}
