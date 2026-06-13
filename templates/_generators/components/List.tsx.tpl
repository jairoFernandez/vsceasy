import React from 'react';

export interface ListProps<T> {
  items: T[];
  getKey: (item: T, index: number) => string | number;
  renderItem: (item: T, index: number) => React.ReactNode;
  onSelect?: (item: T, index: number) => void;
  empty?: React.ReactNode;
}

/** Selectable, theme-aware list. Rows highlight on hover and on selection. */
export function List<T>({ items, getKey, renderItem, onSelect, empty }: ListProps<T>) {
  if (items.length === 0) {
    return <div className="vx-list__empty">{empty ?? 'Nothing here yet.'}</div>;
  }
  return (
    <ul className="vx-list" role="list">
      {items.map((item, i) => (
        <li
          key={getKey(item, i)}
          className={`vx-list__row${onSelect ? ' vx-list__row--clickable' : ''}`}
          onClick={onSelect ? () => onSelect(item, i) : undefined}
        >
          {renderItem(item, i)}
        </li>
      ))}
    </ul>
  );
}
