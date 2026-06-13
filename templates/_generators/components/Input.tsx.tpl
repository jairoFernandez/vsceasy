import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/** Theme-aware text input using VS Code input tokens. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className = '', ...rest }, ref) {
    return <input ref={ref} className={`vx-input ${className}`.trim()} {...rest} />;
  },
);
