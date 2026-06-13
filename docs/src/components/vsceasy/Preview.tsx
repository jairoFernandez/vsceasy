import React, { useState } from 'react';
import './theme.css';

type Theme = 'dark' | 'light';

interface PreviewProps {
  /** Optional caption shown on the left of the toolbar. */
  label?: string;
  children: React.ReactNode;
}

/**
 * A theme-toggleable frame that supplies representative VS Code tokens to its
 * children. Wrap any of the generated components to preview them the way they
 * render inside a real webview.
 */
export default function Preview({ label = 'Live preview · VS Code tokens', children }: PreviewProps) {
  const [theme, setTheme] = useState<Theme>('dark');
  return (
    <div className="vx-frame" data-vx-theme={theme}>
      <div className="vx-frame__bar">
        <span style={{ color: 'var(--vscode-descriptionForeground)' }}>{label}</span>
        <span className="vx-frame__toggle" role="group" aria-label="Preview theme">
          <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Dark</button>
          <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Light</button>
        </span>
      </div>
      {children}
    </div>
  );
}
