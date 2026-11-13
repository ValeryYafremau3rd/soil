import Phaser from 'phaser'
import type { TravelController, TravelLocation } from '../../app/contracts/travel'
import { BUS_STOP } from '../../content/interactive'
import { createCutoutTexture } from '../rendering/createCutoutTexture'
import { InteractiveObject } from './InteractiveObject'
import { worldSurfaces } from '../physics/surfaces'
import { createObjectLight } from '../rendering/createObjectLight'

export class BusStop extends InteractiveObject {
  private readonly travel: TravelController

  static preload(scene: Phaser.Scene): void {
    scene.load.image(BUS_STOP.sourceKey, `${import.meta.env.BASE_URL}${BUS_STOP.path}`)
  }

  constructor(scene: Phaser.Scene, location: TravelLocation, groundY: number, travel: TravelController) {
    createCutoutTexture(scene, BUS_STOP.sourceKey, BUS_STOP.textureKey)
    super(scene, scene.add.image(location.busStop.x, groundY, BUS_STOP.textureKey), location.busStop.interactionRadius, BUS_STOP.prompt)
    this.travel = travel
    this.sprite.setScale(location.busStop.scale).setOrigin(0.5, BUS_STOP.groundOrigin)
    createObjectLight(scene, 'busStop', () => ({ x: this.sprite.x,
      y: this.sprite.getBounds().top, visible: this.sprite.visible }))
  }

  protected interact(): void {
    this.travel.openTravel()
  }

  get platforms() { return worldSurfaces('bus-stop', this.sprite.getBounds(), BUS_STOP.platforms) }
}
