import type Phaser from 'phaser'
import type { DialogueController } from '../../app/contracts/dialogue'
import type { NpcDefinition } from '../../content/types'
import type { Hero } from './Hero'
import { Npc } from './Npc'
import { createWorldHint } from '../rendering/createWorldHint'
import { GAME_SETTINGS } from '../../content/world'

/**
 * Owns dialogue npc state and behavior.
 */
export class DialogueNpc extends Npc {
  private readonly dialogue: DialogueController
  private readonly context: {
    buildingId?: string
    roomId?: string
    npcId?: string
  }
  private readonly questHint: Phaser.GameObjects.Text
  private readonly offer: () => string | null

  /**
   * Initialize the DialogueNpc instance and its collaborators.
   * @param {Scene} scene - Phaser scene that owns rendering and resources.
   * @param {NpcDefinition} definition - The definition supplied to this operation.
   * @param {number} x - Horizontal coordinate.
   * @param {number} groundY - The ground y supplied to this operation.
   * @param {DialogueController} dialogue - The dialogue supplied to this operation.
   * @param {{ buildingId?: string | undefined; roomId?: string | undefined; npcId?: string | undefined; }} context - The context supplied to this operation.
   * @param {() => string | null} offer - The offer supplied to this operation.
   * @returns {DialogueNpc} The initialized instance.
   */
  constructor(
    scene: Phaser.Scene,
    definition: NpcDefinition,
    x: number,
    groundY: number,
    dialogue: DialogueController,
    context: {
      buildingId?: string
      roomId?: string
      npcId?: string
    } = {},
    offer: () => string | null = () => null
  ) {
    super(scene, definition, x, groundY)
    this.dialogue = dialogue
    this.context = context
    this.offer = offer
    this.questHint = createWorldHint(scene, x, groundY, '').setWordWrapWidth(GAME_SETTINGS.interaction.hintWidth)
  }

  /**
   * Set context.
   * @param {string | undefined} buildingId - The building id supplied to this operation.
   * @param {string | undefined} roomId - The room id supplied to this operation.
   * @returns {void} Completes the operation without returning a value.
   */
  setContext(
    buildingId?: string,
    roomId?: string
  ): void {
    this.setVisible(this.context.buildingId === buildingId && this.context.roomId === roomId)
    const text = this.offer()
    this.questHint.setText(text ?? '').setVisible(this.sprite.visible && !!text)
      .setPosition(
        this.sprite.x,
        this.sprite.y - this.sprite.displayHeight - GAME_SETTINGS.interaction.hintGap * 3
      )
  }

  /**
   * Check whether interact with is allowed.
   * @param {Hero} hero - The hero supplied to this operation.
   * @returns {boolean} Whether the requested condition is satisfied.
   */
  override canInteractWith(hero: Hero): boolean {
    return this.definition.dialogue !== undefined && super.canInteractWith(hero)
  }

  /**
   * Perform interact for DialogueNpc.
   * @returns {void} Completes the operation without returning a value.
   */
  protected interact(): void {
    if (this.definition.dialogue) this.dialogue.openDialogue(
      this.definition.name,
      this.definition.dialogue,
      this.context.npcId
    )
  }

  /**
   * Perform destroy for DialogueNpc.
   * @returns {void} Completes the operation without returning a value.
   */
  override destroy(): void {
    this.questHint.destroy()
    super.destroy()
  }
}
