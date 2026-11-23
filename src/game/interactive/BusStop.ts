import Phaser from 'phaser'
import type { TravelController, TravelLocation } from '../../app/contracts/travel'
import { BUS_STOP } from '../../content/interactive'
import { createCutoutTexture } from '../rendering/createCutoutTexture'
import { InteractiveObject } from './InteractiveObject'
import { worldSurfaces } from '../physics/surfaces'
import { createObjectLight } from '../rendering/createObjectLight'

/**
 * Owns bus stop state and behavior.
 */
export class BusStop extends InteractiveObject {
  private readonly travel: TravelController

  /**
   * Perform preload for BusStop.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @returns {void} Completes the operation without returning a value.
   */
  static preload(scene: Phaser.Scene): void {
    scene.load.image(BUS_STOP.sourceKey, `${import.meta.env.BASE_URL}${BUS_STOP.path}`)
  }

  /**
   * Initialize the BusStop instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {TravelLocation} location - The location supplied to this operation.
   * @param {number} groundY - The ground y supplied to this operation.
   * @param {TravelController} travel - The travel supplied to this operation.
   * @returns {BusStop} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    location: TravelLocation,
    groundY: number,
    travel: TravelController
  ) {
    createCutoutTexture(scene, BUS_STOP.sourceKey, BUS_STOP.textureKey)
    super(
      scene,
      scene.add.image(location.busStop.x, groundY, BUS_STOP.textureKey),
      location.busStop.interactionRadius,
      BUS_STOP.prompt
    )
    this.travel = travel
    this.sprite.setScale(location.busStop.scale).setOrigin(0.5, BUS_STOP.groundOrigin)
    createObjectLight(scene, 'busStop', () => ({
      x: this.sprite.x,
      y: this.sprite.getBounds().top, visible: this.sprite.visible
    }))
  }

  /**
   * Perform interact for BusStop.
   * @returns {void} Completes the operation without returning a value.
   */
  protected interact(): void {
    this.travel.openTravel()
  }

  /**
   * Perform platforms for BusStop.
   * @returns {Platform[]} The result described by the TypeScript return signature.
   */
  get platforms() {
    return worldSurfaces('bus-stop', this.sprite.getBounds(), BUS_STOP.platforms)
  }
}
