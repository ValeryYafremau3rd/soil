import { reference, requireCondition, surfaces, unique } from './assertions.ts'
import type { ContentContext } from './context.ts'
import { validatePlacement } from './validatePlacement.ts'

/**
 * Validate taskboards against the supported rules.
 * @param {object} context - The context supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function validateTaskboards(context: ContentContext) {
  const { taskboards, ui } = context

  for (const [id, definition] of Object.entries(taskboards.types)) {
    const path = `taskboards.json.types.${id}`
    requireCondition(
      ui.menus.some(menu => menu.id === definition.menuId && menu.id !== 'inventory'),
      `${path}.menuId: unknown HUD menu`
    )
    if (definition.platform) surfaces([definition.platform], `${path}.platform`)

    if (definition.outline) requireCondition(
      definition.outline.length >= 3 && definition.crop
      && definition.outline.every(point => point.x <= definition.crop!.width && point.y <= definition.crop!.height),
      `${path}.outline: expected at least three points within the crop`
    )
  }

  unique(taskboards.placements.map(board => board.id), 'taskboards.json.placements')

  for (const placement of taskboards.placements) {
    const path = `taskboards.json.placements.${placement.id}`
    reference(taskboards.types, placement.type, `${path}.type`)
    const definition = taskboards.types[placement.type]
    requireCondition(
      placement.space === definition.space,
      `${path}.space: does not match the taskboard type`
    )
    const room = validatePlacement(context)(placement, path)
    if (room) requireCondition(
      placement.heightOffset + definition.displayHeight * definition.scale * (placement.scale ?? 1)
      <= (room.floor.y - room.floor.ceiling) * room.scale,
      `${path}.heightOffset: taskboard does not fit on this floor's wall`
    )
  }
}
