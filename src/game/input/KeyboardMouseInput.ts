import Phaser from 'phaser'
import { GAME_SETTINGS } from '../../content/world'

/**
 * Mapped gameplay inputs consumed by the game independently of physical keys.
 */
export interface InputActions {
  optionDirection?: number
  direction: number
  jumpPressed: boolean
  fightPressed: boolean
  shootPressed: boolean
  fightHeld: boolean
  shootHeld: boolean
  interactPressed: boolean
  stairsDirection: number
}

/**
 * Owns keyboard mouse input state and behavior.
 */
export class KeyboardMouseInput {
  private readonly scene: Phaser.Scene
  private readonly keys?: {
    left: Phaser.Input.Keyboard.Key
    right: Phaser.Input.Keyboard.Key
    jump: Phaser.Input.Keyboard.Key
    fight: Phaser.Input.Keyboard.Key
    shoot: Phaser.Input.Keyboard.Key
    interact: Phaser.Input.Keyboard.Key
    up: Phaser.Input.Keyboard.Key
    down: Phaser.Input.Keyboard.Key
  }
  private readonly arrows?: Record<'left' | 'right' | 'up' | 'down', Phaser.Input.Keyboard.Key>
  private enabled = true

  /**
   * Initialize the KeyboardMouseInput instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @returns {KeyboardMouseInput} The initialized instance.
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene
    const keyboard = scene.input.keyboard
    if (keyboard) {
      keyboard.enabled = true
      this.arrows = {
        left: keyboard.addKey('LEFT'),
        right: keyboard.addKey('RIGHT'),
        up: keyboard.addKey('UP'),
        down: keyboard.addKey('DOWN')
      }
      const bindings = GAME_SETTINGS.input

      /**
       * Perform code.
       * @param {string} name - The name supplied to this operation.
       * @returns {number} The calculated numeric result.
       */
      const code = (name: string) => {
        const value = Phaser.Input.Keyboard.KeyCodes[name as keyof typeof Phaser.Input.Keyboard.KeyCodes]
        if (typeof value !== 'number') throw new Error(`settings.json: unknown keyboard key ${name}`)

        return value
      }
      this.keys = {
        left: keyboard.addKey(code(bindings.left)),
        right: keyboard.addKey(code(bindings.right)),
        jump: keyboard.addKey(code(bindings.jump)),
        fight: keyboard.addKey(code(bindings.fight)),
        shoot: keyboard.addKey(code(bindings.shoot)),
        interact: keyboard.addKey(code(bindings.interact)),
        up: keyboard.addKey(code(bindings.up)),
        down: keyboard.addKey(code(bindings.down)),
      }
    }

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this)
  }

  /**
   * Perform read for KeyboardMouseInput.
   * @returns {InputActions} The result described by the TypeScript return signature.
   */
  read(): InputActions {
    const next = this.arrows ? Number(Phaser.Input.Keyboard.JustDown(this.arrows.right)) + Number(Phaser.Input.Keyboard.JustDown(this.arrows.down)) : 0
    const previous = this.arrows ? Number(Phaser.Input.Keyboard.JustDown(this.arrows.left)) + Number(Phaser.Input.Keyboard.JustDown(this.arrows.up)) : 0
    const actions = {
      optionDirection: Math.sign(next - previous),
      direction: this.keys ? Number(this.keys.right.isDown) - Number(this.keys.left.isDown) : 0,
      jumpPressed: this.keys ? Phaser.Input.Keyboard.JustDown(this.keys.jump) : false,
      fightPressed: this.keys ? Phaser.Input.Keyboard.JustDown(this.keys.fight) : false,
      shootPressed: this.keys ? Phaser.Input.Keyboard.JustDown(this.keys.shoot) : false,
      fightHeld: this.keys?.fight.isDown ?? false,
      shootHeld: this.keys?.shoot.isDown ?? false,
      interactPressed: this.keys ? Phaser.Input.Keyboard.JustDown(this.keys.interact) : false,
      stairsDirection: this.keys
        ? Number(Phaser.Input.Keyboard.JustDown(this.keys.up)) - Number(Phaser.Input.Keyboard.JustDown(this.keys.down)) : 0,
    }

    return actions
  }

  /**
   * Set enabled.
   * @param {boolean} enabled - Whether this behavior is enabled.
   * @returns {void} Completes the operation without returning a value.
   */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return

    this.enabled = enabled
    const keyboard = this.scene.input.keyboard
    if (!keyboard || !this.keys) return

    keyboard.enabled = enabled
    keyboard.resetKeys()
    const codes = Object.values({ ...this.keys, ...this.arrows }).map(key => key.keyCode)
    if (enabled) keyboard.addCapture(codes)
    else keyboard.removeCapture(codes)
  }

  /**
   * Perform destroy for KeyboardMouseInput.
   * @returns {void} Completes the operation without returning a value.
   */
  private destroy(): void {
    if (this.keys) {
      for (const key of new Set([...Object.values(this.keys), ...Object.values(this.arrows ?? {})])) this.scene.input.keyboard?.removeKey(key, true)
    }
  }
}
