interface MenuKeyEvent {
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  nativeEvent: { isComposing: boolean }
}

export function isModifiedOrComposing(event: MenuKeyEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing
}
