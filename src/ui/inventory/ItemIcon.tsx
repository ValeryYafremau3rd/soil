import { ITEM_BY_ID, ITEM_SHEET } from '../../content/items'
import { UI_CONFIG } from '../../content/ui'

/**
 * Perform item icon.
 * @param {{ itemId: string size?: number }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function ItemIcon({ itemId, size: requestedSize }: {
  itemId: string
  size?: number
}) {
  const crop = ITEM_BY_ID[itemId].icon
  const sheet = ITEM_BY_ID[itemId].iconSheet ?? ITEM_SHEET
  const clip = ITEM_BY_ID[itemId].iconClip
  const side = Math.max(crop.width, crop.height)
  const size = requestedSize ?? UI_CONFIG.itemIconSize * (ITEM_BY_ID[itemId].scale ?? 1)

  return <span className="item-icon" aria-hidden="true" style={{ width: size, height: size, flexBasis: size }}><span style={{
    width: `${crop.width / side * 100}%`,
    height: `${crop.height / side * 100}%`,
    backgroundImage: `url("${import.meta.env.BASE_URL}${sheet.path}")`,
    clipPath: clip ? `polygon(${clip.map(point => `${point.x * 100}% ${point.y * 100}%`).join(', ')})` : undefined,
    backgroundSize: `${sheet.width / crop.width * 100}% ${sheet.height / crop.height * 100}%`,
    backgroundPosition: `${crop.x / (sheet.width - crop.width) * 100}% ${crop.y / (sheet.height - crop.height) * 100}%`,
  }} /></span>
}
