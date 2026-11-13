import type Phaser from 'phaser'
import type { DialogueController } from '../../app/contracts/dialogue'
import type { NpcDefinition } from '../../content/types'
import type { Hero } from './Hero'
import { Npc } from './Npc'
import { createWorldHint } from '../rendering/createWorldHint'
import { GAME_SETTINGS } from '../../content/world'

export class DialogueNpc extends Npc {
  private readonly dialogue: DialogueController
  private readonly context: { buildingId?: string; roomId?: string; npcId?: string }
  private readonly questHint: Phaser.GameObjects.Text
  private readonly offer: () => string | null

  constructor(scene: Phaser.Scene, definition: NpcDefinition, x: number, groundY: number, dialogue: DialogueController,
    context: { buildingId?: string; roomId?: string; npcId?: string } = {}, offer: () => string | null = () => null) {
    super(scene, definition, x, groundY)
    this.dialogue = dialogue
    this.context = context
    this.offer = offer
    this.questHint = createWorldHint(scene, x, groundY, '').setWordWrapWidth(GAME_SETTINGS.interaction.hintWidth)
  }

  setContext(buildingId?: string, roomId?: string): void {
    this.setVisible(this.context.buildingId === buildingId && this.context.roomId === roomId)
    const text = this.offer()
    this.questHint.setText(text ?? '').setVisible(this.sprite.visible && !!text)
      .setPosition(this.sprite.x, this.sprite.y - this.sprite.displayHeight - GAME_SETTINGS.interaction.hintGap * 3)
  }

  override canInteractWith(hero: Hero): boolean {
    return this.definition.dialogue !== undefined && super.canInteractWith(hero)
  }

  protected interact(): void {
    if (this.definition.dialogue) this.dialogue.openDialogue(this.definition.name, this.definition.dialogue, this.context.npcId)
  }
  override destroy(): void { this.questHint.destroy(); super.destroy() }
}
