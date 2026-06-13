import React from 'react';

type Variant = 'primary' | 'secondary';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** Theme-aware button using VS Code button tokens. */
export function Button({ variant = 'primary', className = '', ...rest }: ButtonProps) {
  return <button className={`vx-btn vx-btn--${variant} ${className}`.trim()} {...rest} />;
}
