import { useId } from 'react'
import type { Rect } from '../../content/types'

/** Crop a sprite sheet in DOM UI; optionally key out its neutral checkerboard. */
export function SpriteIcon({ sheet, crop, removeNeutralBackground = false }: {
  sheet: { path: string; width: number; height: number }; crop: Rect; removeNeutralBackground?: boolean
}) {
  const filterId = useId()
  return <svg className="sprite-icon" viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`} aria-hidden="true">
    {removeNeutralBackground && <defs><filter id={filterId} colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  3 0 -3 0 0" />
    </filter></defs>}
    <image href={`${import.meta.env.BASE_URL}${sheet.path}`} width={sheet.width} height={sheet.height}
      filter={removeNeutralBackground ? `url(#${filterId})` : undefined} />
  </svg>
}
