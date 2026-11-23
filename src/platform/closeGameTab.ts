/**
 * Close game tab.
 * @param {() => void} onBlocked - The on blocked supplied to this operation.
 * @returns {void} Completes the operation without returning a value.
 */
export function closeGameTab(onBlocked: () => void): void {
  window.setTimeout(() => {
    if (!window.closed) onBlocked()
  }, 150)
  window.close()
}
