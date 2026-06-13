import React from 'react';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

/** Labeled form field wrapper with optional hint / error text. */
export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div className="vx-field">
      <label className="vx-field__label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="vx-field__error">{error}</span> : hint ? <span className="vx-field__hint">{hint}</span> : null}
    </div>
  );
}
