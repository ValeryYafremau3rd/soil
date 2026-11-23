import type { DialogueChoice, DialogueDefinition } from './dialogue.ts'

/**
 * Check whether a selected reply has any remaining visible questions below it.
 * @param {DialogueDefinition} definition - Dialogue graph containing the reply.
 * @param {string} nodeId - Node owning the displayed reply.
 * @param {DialogueChoice} choice - Reply whose visited appearance is being derived.
 * @param {(nodeId: string, choice: DialogueChoice) => boolean} wasSelected - Selection history.
 * @param {(choice: DialogueChoice) => boolean} isVisible - Current quest visibility rules.
 * @returns {boolean} Whether the reply and all nested questions have been selected.
 */
export function isChoiceExhausted(
  definition: DialogueDefinition,
  nodeId: string,
  choice: DialogueChoice,
  wasSelected: (nodeId: string, choice: DialogueChoice) => boolean,
  isVisible: (choice: DialogueChoice) => boolean,
): boolean {
  /**
   * Follow questions while excluding exits and links back to an ancestor menu.
   * @param {string} owner - Node owning the nested reply.
   * @param {DialogueChoice} reply - Reply to check against selection history.
   * @param {ReadonlySet<string>} ancestors - Menus already on this traversal path.
   * @returns {boolean} Whether this branch contains no unselected questions.
   */
  function isExhausted(
    owner: string,
    reply: DialogueChoice,
    ancestors: ReadonlySet<string>,
  ): boolean {
    if (!wasSelected(owner, reply)) return false
    if (reply.close || !reply.next || ancestors.has(reply.next)) return true

    const path = new Set([...ancestors, reply.next])
    const children = definition.nodes[reply.next]?.choices ?? []

    return children.every(child => {
      if (child.close || child.id === 'goodbye' || !isVisible(child)) return true
      if (child.next && path.has(child.next)) return true

      return isExhausted(reply.next!, child, path)
    })
  }

  return isExhausted(nodeId, choice, new Set([definition.start, nodeId]))
}
