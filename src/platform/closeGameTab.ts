export function closeGameTab(onBlocked: () => void): void {
  window.setTimeout(() => {
    if (!window.closed) onBlocked()
  }, 150)
  window.close()
}
