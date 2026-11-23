/** Rewards transitions, never individual frames. Context changes cancel pursuit credit. */
export class PatrolPerkTracker {
  private readonly chasing = new Set<string>()
  private readonly awaitingHideout = new Set<string>()
  private readonly concealed = new Set<string>()

  /**
   * Clear active pursuits and pending hideout credit when the world context changes.
   * @returns {void} Prevents a previous area's pursuers from granting escape rewards.
   */
  cancelChases(): void {
    this.chasing.clear()
    this.awaitingHideout.clear()
  }

  /**
   * Track pursuit transitions and award hiding after a living pursuer loses detection.
   * @param {string} id - Stable identity of the observed patrol.
   * @param {{ alive: boolean; visible: boolean; hidden: boolean; inRange: boolean; detected: boolean; }} state - Current state used by the rule.
   * @returns {("policeEscaped" | "policeHidden" | "chaseHidden")[]} Events earned by this transition.
   */
  observe(
    id: string,
    state: {
      alive: boolean
      visible: boolean
      hidden: boolean
      inRange: boolean
      detected: boolean
    }
  ): ('policeEscaped' | 'policeHidden' | 'chaseHidden')[] {
    const events: ('policeEscaped' | 'policeHidden' | 'chaseHidden')[] = []
    if (!state.alive || !state.visible) {
      this.chasing.delete(id)
      this.awaitingHideout.delete(id)

      return events
    }

    // Hiding is forbidden in detection range, so pursuit must survive the approach to cover.
    if (state.hidden && this.awaitingHideout.delete(id)) events.push('chaseHidden')

    if (state.hidden && state.inRange && !this.concealed.has(id)) {
      this.concealed.add(id)
      events.push('policeHidden')
    }

    if (this.chasing.has(id) && !state.detected && !state.inRange && !state.hidden) events.push('policeEscaped')

    if (state.detected && !state.hidden) {
      this.chasing.add(id)
      this.awaitingHideout.add(id)
    } else this.chasing.delete(id)

    return events
  }
}
