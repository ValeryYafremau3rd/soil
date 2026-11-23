import { useEffect, useSyncExternalStore } from 'react'
import type { GameMessage, MessageController } from '../../app/contracts/messages'
import { HERO_SETTINGS } from '../../content/hero'
import './messages.css'

/**
 * Perform message.
 * @param {{ message: GameMessage messages: MessageController }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
function Message({ message, messages }: {
  message: GameMessage
  messages: MessageController
}) {
  const floating = message.presentation === 'success'
  const duration = floating ? HERO_SETTINGS.attackTiming.feedbackDurationMs : 4000
  useEffect(() => {
    const timer = window.setTimeout(() => messages.dismiss(message.id), duration)

    return () => window.clearTimeout(timer)
  }, [message.id, messages, duration])
  if (floating) return <p className="game-message-success" role="status" style={{
    top: `calc(50% - ${HERO_SETTINGS.attackTiming.feedbackOffset}px)`,
    color: `#${HERO_SETTINGS.attackTiming.perfectColor.toString(16).padStart(6, '0')}`,
    animationDuration: `${duration}ms`,
  }}>{message.text}</p>

  return <p className="game-message" role="status">{message.text}</p>
}

/**
 * Perform game messages.
 * @param {{ messages: MessageController }} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function GameMessages({ messages }: {
  messages: MessageController
}) {
  const snapshot = useSyncExternalStore(messages.subscribe, messages.getSnapshot)

  return <><aside className="game-messages" aria-label="Game messages">
    {snapshot.messages.filter(message => message.presentation !== 'success').slice(0, 3).map(message => <Message key={message.id} message={message} messages={messages} />)}
  </aside><aside className="game-success-messages" aria-label="Success messages">
      {snapshot.messages.filter(message => message.presentation === 'success').map(message => <Message key={message.id} message={message} messages={messages} />)}
    </aside></>
}
