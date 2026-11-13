import type Phaser from 'phaser'
import type { Weather } from '../../domain/character/weather'
import { WORLD_LAYERS } from '../../content/world'

/** Camera-local geometry: no textures, physics bodies, or external assets. */
export class WeatherOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics
  private readonly scene: Phaser.Scene
  private elapsed = 0
  private readonly motes = Array.from({ length: 150 }, () => ({ x: Math.random(), y: Math.random(), speed: 0.6 + Math.random() }))

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(WORLD_LAYERS.daytimeTint + 0.1)
  }

  update(delta: number, weather: Weather, indoors: boolean): void {
    const g = this.graphics
    g.clear().setVisible(!indoors && weather !== 'clear')
    if (indoors || weather === 'clear') return
    this.elapsed += Math.min(delta, 100) / 1000
    const { width, height } = this.scene.cameras.main
    const t = this.elapsed
    if (weather === 'fog') {
      g.fillStyle(0xcbd8dd, 0.13).fillRect(0, 0, width, height)
      for (let i = 0; i < 6; i++) {
        g.fillStyle(0xdbe5e8, 0.055)
        g.fillEllipse(((i * 239 + t * 18) % (width + 500)) - 250, height * (0.3 + i * 0.13), 650, 180)
      }
      return
    }
    const rain = weather === 'rain' || weather === 'storm'
    if (weather === 'storm') {
      g.fillStyle(0x182236, 0.2).fillRect(0, 0, width, height)
      const flash = t % 11
      if (flash < 0.08 || flash > 0.2 && flash < 0.25) g.fillStyle(0xe8efff, 0.32).fillRect(0, 0, width, height)
    }
    const count = weather === 'rain' ? 100 : weather === 'wind' ? 45 : this.motes.length
    g.lineStyle(1, rain ? 0xb9d7ef : 0xc4b499, rain ? 0.55 : 0.35)
    for (const mote of this.motes.slice(0, count)) {
      const x = ((mote.x * (width + 80) + t * (rain ? -110 : weather === 'wind' ? 220 : 20) * mote.speed) % (width + 80) + width + 80) % (width + 80) - 40
      const y = (mote.y * (height + 40) + t * (rain ? 650 : weather === 'wind' ? 12 : 35) * mote.speed) % (height + 40) - 20
      if (weather === 'snow') g.fillStyle(0xf1f6ff, 0.8).fillCircle(x + Math.sin(t + mote.y * 20) * 15, y, 1.5 * mote.speed)
      else g.lineBetween(x, y, x + (rain ? -4 : 18), y + (rain ? 17 : -2))
    }
  }
}
