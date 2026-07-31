import React, { useEffect, useMemo, useRef, useState } from 'react';
import './theme.css';
import './showcase.css';

type Theme = 'dark' | 'light';

interface Use {
  /** Feature id — must exist in FEATURES. */
  feature: string;
  how: string;
}

interface Project {
  id: string;
  name: string;
  type: string;
  tagline: string;
  repo: string;
  create: string;
  uses: Use[];
  mock: () => React.ReactNode;
}

/**
 * Supplies VS Code theme tokens to a mock without the preview frame's own
 * border/padding — the mocks draw their own chrome, and the surrounding card
 * must keep the docs' text colors.
 */
function MockFrame({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <div className="vx-frame" data-vx-theme={theme} style={{ border: 0, padding: 0, background: 'transparent' }}>
      {children}
    </div>
  );
}

const FEATURES: Array<{ id: string; label: string; href: string }> = [
  { id: 'editor-surface', label: 'Editor surface', href: '/guides/editor-surface/' },
  { id: 'llm', label: 'LLM client', href: '/guides/llm/' },
  { id: 'sidebar-views', label: 'Sidebar views', href: '/guides/sidebar-views/' },
  { id: 'rpc', label: 'Typed RPC', href: '/guides/rpc/' },
  { id: 'orm', label: 'Mini-ORM', href: '/guides/orm/' },
  { id: 'status-bar', label: 'Status bar', href: '/commands/statusbar-add/' },
  { id: 'jobs', label: 'Jobs & helpers', href: '/commands/job-add/' },
  { id: 'language', label: 'Language support', href: '/guides/language-extensions/' },
  { id: 'contributes-extra', label: 'contributes.extra.json', href: '/guides/language-extensions/#contributesextrajson' },
  { id: 'doctor', label: 'doctor', href: '/commands/doctor/' },
];

const FEATURE_LABEL = Object.fromEntries(FEATURES.map((f) => [f.id, f.label]));
const FEATURE_HREF = Object.fromEntries(FEATURES.map((f) => [f.id, f.href]));

/* ── Code Trainer mock ─────────────────────────────────────────────────────
   A transcription session: ghost text ahead of the cursor, live WPM/accuracy
   in the status bar, paste refused by a typing guard. */

const SOLUTION = 'const seen = new Map<number, number>();';

function CodeTrainerMock() {
  const [typed, setTyped] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>('arrays');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setTyped((n) => {
        if (n >= SOLUTION.length) {
          setPlaying(false);
          return n;
        }
        return n + 1;
      });
    }, 55);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing]);

  // Representative metrics, derived from progress so the bar actually moves.
  const pct = Math.round((typed / SOLUTION.length) * 100);
  const wpm = typed === 0 ? 0 : 48 + (typed % 17);
  const accuracy = typed === 0 ? 100 : 100 - Math.min(6, Math.floor(typed / 9));

  const toggle = () => {
    if (typed >= SOLUTION.length) setTyped(0);
    setPlaying((p) => !p);
  };

  return (
    <div className="px-mock">
      <div className="px-mock__body">
        <div className="px-mock__rail" aria-hidden="true">
          <span data-active="true">◎</span>
          <span>⌕</span>
          <span>⑂</span>
        </div>
        <div className="px-mock__pane">
          <div className="px-mock__section">
            <span>Catalog</span>
            <span className="px-mock__actions" aria-hidden="true">⟳ ＋ ⋯</span>
          </div>
          <button
            className="px-mock__row"
            data-selected={open === 'arrays'}
            onClick={() => setOpen(open === 'arrays' ? null : 'arrays')}
            aria-expanded={open === 'arrays'}
          >
            <span aria-hidden="true">{open === 'arrays' ? '⌄' : '›'}</span>
            Arrays &amp; Hashing
            <span className="px-mock__badge">4/12</span>
          </button>
          {open === 'arrays' && (
            <>
              <button className="px-mock__row" data-child="true" data-selected="true" onClick={toggle}>
                <span aria-hidden="true">•</span> Two Sum <span className="px-mock__badge">E</span>
              </button>
              <button className="px-mock__row" data-child="true" onClick={toggle}>
                <span aria-hidden="true">•</span> Group Anagrams <span className="px-mock__badge">M</span>
              </button>
            </>
          )}
          <button
            className="px-mock__row"
            onClick={() => setOpen(open === 'window' ? null : 'window')}
            aria-expanded={open === 'window'}
          >
            <span aria-hidden="true">{open === 'window' ? '⌄' : '›'}</span>
            Sliding Window
            <span className="px-mock__badge">0/6</span>
          </button>
          {open === 'window' && (
            <button className="px-mock__row" data-child="true" onClick={toggle}>
              <span aria-hidden="true">•</span> Longest Substring <span className="px-mock__badge">M</span>
            </button>
          )}
        </div>
      </div>

      <pre className="px-mock__code">
        <code>
          {SOLUTION.slice(0, typed)}
          <span className="px-caret" aria-hidden="true" />
          <span className="px-mock__ghost">{SOLUTION.slice(typed)}</span>
        </code>
      </pre>

      <div className="px-mock__status" data-warn={blocked ? 'true' : 'false'}>
        {blocked ? (
          <span>⚠ {blocked}</span>
        ) : (
          <>
            <span>⚡ {wpm} wpm</span>
            <span>{accuracy}% acc</span>
            <span>{pct}%</span>
          </>
        )}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.4rem' }}>
          <button className="px-mock__row" style={{ width: 'auto' }} onClick={toggle}>
            {playing ? 'Pause' : typed >= SOLUTION.length ? 'Restart' : 'Type it'}
          </button>
          <button
            className="px-mock__row"
            style={{ width: 'auto' }}
            onClick={() => {
              setBlocked('Paste disabled — type it out.');
              setTimeout(() => setBlocked(null), 1800);
            }}
          >
            Paste
          </button>
        </span>
      </div>
    </div>
  );
}

/* ── TOML mock ─────────────────────────────────────────────────────────────
   The same snippet with scoped token colors on and off. */

const TOML_LINES: Array<Array<{ t: string; k: keyof typeof TOKEN_COLORS | 'plain' }>> = [
  [{ t: '# build metadata', k: 'comment' }],
  [{ t: '[package]', k: 'section' }],
  [
    { t: 'name', k: 'key' },
    { t: ' = ', k: 'plain' },
    { t: '"vsceasy"', k: 'string' },
  ],
  [
    { t: 'version', k: 'key' },
    { t: ' = ', k: 'plain' },
    { t: '"0.1.11"', k: 'string' },
  ],
  [
    { t: 'edition', k: 'key' },
    { t: ' = ', k: 'plain' },
    { t: '2024', k: 'number' },
  ],
  [
    { t: 'published', k: 'key' },
    { t: ' = ', k: 'plain' },
    { t: 'true', k: 'bool' },
  ],
  [{ t: '[[bin]]', k: 'section' }],
  [
    { t: 'path', k: 'key' },
    { t: ' = ', k: 'plain' },
    { t: "'src/bin/cli.ts'", k: 'string' },
  ],
];

const TOKEN_COLORS = {
  comment: '#6b7a6e',
  section: '#e6c07b',
  key: '#56b6c2',
  string: '#98c379',
  number: '#d19a66',
  bool: '#c678dd',
} as const;

function TomlMock() {
  const [colorized, setColorized] = useState(true);
  return (
    <div className="px-mock">
      <div className="px-mock__section" style={{ padding: '0.35rem 0.65rem' }}>
        <span>Cargo.toml</span>
        <button
          className="px-mock__row"
          style={{ width: 'auto' }}
          aria-pressed={colorized}
          onClick={() => setColorized((c) => !c)}
        >
          colorize: {colorized ? 'on' : 'off'}
        </button>
      </div>
      <pre className="px-mock__code">
        <code>
          {TOML_LINES.map((line, i) => (
            <div key={i}>
              {line.map((tok, j) => (
                <span
                  key={j}
                  style={{
                    color: colorized && tok.k !== 'plain' ? TOKEN_COLORS[tok.k] : undefined,
                    fontStyle: colorized && tok.k === 'comment' ? 'italic' : undefined,
                    fontWeight: colorized && tok.k === 'section' ? 600 : undefined,
                  }}
                >
                  {tok.t}
                </span>
              ))}
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}

/* ── Projects ──────────────────────────────────────────────────────────────── */

const PROJECTS: Project[] = [
  {
    id: 'code-coach',
    name: 'Code Trainer',
    type: 'type: ui',
    tagline:
      'Practise algorithms by actually typing them — real WPM and accuracy, paste refused, exercises generated and verified by a local model.',
    repo: 'https://github.com/jairoFernandez/code-coach',
    create: 'vsceasy create code-coach --type ui',
    uses: [
      { feature: 'editor-surface', how: 'Typing guards swallow wrong keys and block paste; ghost text shows the reference solution; decorations dim it; a captured terminal runs the tests.' },
      { feature: 'llm', how: 'Exercise generation, assisted ghost text and the “Ask the coach” chat — local Ollama, auto model resolution, settings-driven client.' },
      { feature: 'sidebar-views', how: 'Problem catalogue grouped by interview pattern, conversation list, and “Add problems” actions ordered in one container.' },
      { feature: 'rpc', how: 'Dashboard and chat panel share the same history with the sidebar over RPC events.' },
      { feature: 'orm', how: 'Problems, sessions, streaks and chat turns persisted as entities; views re-render from watchEntity.' },
      { feature: 'status-bar', how: 'Live WPM / accuracy / progress, amber under 85%, day streak between sessions, click for the action menu.' },
      { feature: 'jobs', how: 'Habit tracking plus the config and state helpers.' },
    ],
    mock: () => <CodeTrainerMock />,
  },
  {
    id: 'toml',
    name: 'TOML',
    type: 'type: language',
    tagline:
      'TOML language support: highlighting for .toml (and Cargo.lock, poetry.lock, Pipfile…), language configuration, snippets, an opt-in file icon and color theme.',
    repo: 'https://github.com/jairoFernandez/toml_extension',
    create: 'vsceasy create toml-support --type language',
    uses: [
      { feature: 'language', how: 'The whole skeleton — grammar, language-configuration.json, snippets, file icon — scaffolded in one command. No React, no RPC.' },
      { feature: 'contributes-extra', how: 'languages, grammars, snippets, iconThemes and themes merged into package.json#contributes by gen.' },
      { feature: 'doctor', how: 'Verifies every referenced grammar / snippet / icon asset exists before packaging.' },
    ],
    mock: () => <TomlMock />,
  },
];

/* ── The showcase ──────────────────────────────────────────────────────────── */

export default function ProjectShowcase() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [active, setActive] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of PROJECTS) for (const u of p.uses) c[u.feature] = (c[u.feature] ?? 0) + 1;
    return c;
  }, []);

  const matches = (p: Project) => !active || p.uses.some((u) => u.feature === active);
  const visible = PROJECTS.filter(matches);

  return (
    <div>
      <div className="px-toolbar">
        <span className="px-toolbar__label">Filter by feature:</span>
        {FEATURES.filter((f) => counts[f.id]).map((f) => (
          <button
            key={f.id}
            className="px-chip"
            aria-pressed={active === f.id}
            onClick={() => setActive(active === f.id ? null : f.id)}
          >
            {f.label}
            <span className="px-chip__count">{counts[f.id]}</span>
          </button>
        ))}
        {active && (
          <button className="px-chip" onClick={() => setActive(null)}>
            Clear
          </button>
        )}
        <span className="vx-frame__toggle" role="group" aria-label="Preview theme" style={{ marginLeft: 'auto' }}>
          <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Dark</button>
          <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Light</button>
        </span>
      </div>

      <div className="px-grid">
        {PROJECTS.map((p) => {
          const hit = matches(p);
          const isOpen = expanded[p.id];
          const uses = isOpen ? p.uses : p.uses.slice(0, 3);
          return (
            <article key={p.id} className="px-card" data-dimmed={!hit} data-matched={!!active && hit}>
              <div className="px-card__head">
                <h3 className="px-card__title">{p.name}</h3>
                <span className="px-card__type">{p.type}</span>
              </div>
              <p className="px-card__tagline">{p.tagline}</p>

              <MockFrame theme={theme}>{p.mock()}</MockFrame>

              <code className="px-card__cmd">{p.create}</code>

              <ul className="px-uses">
                {uses.map((u) => (
                  <li key={u.feature} className="px-uses__item" data-hit={active === u.feature}>
                    <a className="px-uses__feature" href={FEATURE_HREF[u.feature]}>
                      {FEATURE_LABEL[u.feature]}
                    </a>{' '}
                    <span className="px-uses__how">— {u.how}</span>
                  </li>
                ))}
              </ul>
              {p.uses.length > 3 && (
                <button
                  className="px-more"
                  onClick={() => setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))}
                >
                  {isOpen ? 'Show fewer features' : `Show ${p.uses.length - 3} more features`}
                </button>
              )}

              <div className="px-links">
                <a href={p.repo}>Source on GitHub →</a>
              </div>
            </article>
          );
        })}
      </div>

      {visible.length === 0 && (
        <p className="px-empty">No project on this page uses that feature yet.</p>
      )}
    </div>
  );
}
