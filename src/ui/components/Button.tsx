import type { ButtonHTMLAttributes } from 'react'

/**
 * Shared button presentation options together with native button attributes.
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

/**
 * Perform button.
 * @param {ButtonProps} options - The options supplied to this operation.
 * @returns {Element} The result described by the TypeScript return signature.
 */
export function Button({ children, variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button type="button" {...props} className={`ui-button ui-button--${variant} ${className}`}>
    {children}
  </button>
}
