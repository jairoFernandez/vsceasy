import React from 'react';

export interface CardProps {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** Bordered surface for grouping content, with an optional title + actions row. */
export function Card({ title, actions, children }: CardProps) {
  return (
    <section className="vx-card">
      {(title || actions) && (
        <header className="vx-card__head">
          {title ? <h2 className="vx-card__title">{title}</h2> : <span />}
          {actions ? <div className="vx-card__actions">{actions}</div> : null}
        </header>
      )}
      <div className="vx-card__body">{children}</div>
    </section>
  );
}
