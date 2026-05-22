export interface Codicon {
  name: string;
  category: CodiconCategory;
}

export type CodiconCategory =
  | 'actions'
  | 'symbols'
  | 'files'
  | 'ui'
  | 'git'
  | 'debug'
  | 'terminal'
  | 'editor'
  | 'media'
  | 'misc';

export const CODICONS: Codicon[] = [
  // actions
  { name: 'play', category: 'actions' },
  { name: 'play-circle', category: 'actions' },
  { name: 'debug-start', category: 'actions' },
  { name: 'debug-stop', category: 'actions' },
  { name: 'debug-restart', category: 'actions' },
  { name: 'debug-pause', category: 'actions' },
  { name: 'stop', category: 'actions' },
  { name: 'stop-circle', category: 'actions' },
  { name: 'refresh', category: 'actions' },
  { name: 'sync', category: 'actions' },
  { name: 'add', category: 'actions' },
  { name: 'remove', category: 'actions' },
  { name: 'trash', category: 'actions' },
  { name: 'edit', category: 'actions' },
  { name: 'save', category: 'actions' },
  { name: 'save-all', category: 'actions' },
  { name: 'cloud-upload', category: 'actions' },
  { name: 'cloud-download', category: 'actions' },
  { name: 'export', category: 'actions' },
  { name: 'desktop-download', category: 'actions' },
  { name: 'search', category: 'actions' },
  { name: 'filter', category: 'actions' },
  { name: 'replace', category: 'actions' },
  { name: 'check', category: 'actions' },
  { name: 'close', category: 'actions' },
  { name: 'eye', category: 'actions' },
  { name: 'eye-closed', category: 'actions' },
  { name: 'lock', category: 'actions' },
  { name: 'unlock', category: 'actions' },
  { name: 'key', category: 'actions' },

  // symbols
  { name: 'symbol-class', category: 'symbols' },
  { name: 'symbol-method', category: 'symbols' },
  { name: 'symbol-function', category: 'symbols' },
  { name: 'symbol-variable', category: 'symbols' },
  { name: 'symbol-constant', category: 'symbols' },
  { name: 'symbol-property', category: 'symbols' },
  { name: 'symbol-field', category: 'symbols' },
  { name: 'symbol-event', category: 'symbols' },
  { name: 'symbol-interface', category: 'symbols' },
  { name: 'symbol-enum', category: 'symbols' },
  { name: 'symbol-module', category: 'symbols' },
  { name: 'symbol-namespace', category: 'symbols' },
  { name: 'symbol-array', category: 'symbols' },
  { name: 'symbol-boolean', category: 'symbols' },
  { name: 'symbol-numeric', category: 'symbols' },
  { name: 'symbol-string', category: 'symbols' },
  { name: 'symbol-misc', category: 'symbols' },
  { name: 'symbol-color', category: 'symbols' },
  { name: 'symbol-key', category: 'symbols' },
  { name: 'symbol-parameter', category: 'symbols' },
  { name: 'symbol-snippet', category: 'symbols' },

  // files
  { name: 'file', category: 'files' },
  { name: 'file-code', category: 'files' },
  { name: 'file-text', category: 'files' },
  { name: 'file-media', category: 'files' },
  { name: 'file-pdf', category: 'files' },
  { name: 'file-zip', category: 'files' },
  { name: 'file-binary', category: 'files' },
  { name: 'file-symlink-file', category: 'files' },
  { name: 'file-symlink-directory', category: 'files' },
  { name: 'files', category: 'files' },
  { name: 'folder', category: 'files' },
  { name: 'folder-opened', category: 'files' },
  { name: 'folder-active', category: 'files' },
  { name: 'folder-library', category: 'files' },
  { name: 'new-file', category: 'files' },
  { name: 'new-folder', category: 'files' },
  { name: 'archive', category: 'files' },

  // ui
  { name: 'home', category: 'ui' },
  { name: 'dashboard', category: 'ui' },
  { name: 'gear', category: 'ui' },
  { name: 'settings', category: 'ui' },
  { name: 'settings-gear', category: 'ui' },
  { name: 'preferences', category: 'ui' },
  { name: 'list-flat', category: 'ui' },
  { name: 'list-tree', category: 'ui' },
  { name: 'list-unordered', category: 'ui' },
  { name: 'list-ordered', category: 'ui' },
  { name: 'list-selection', category: 'ui' },
  { name: 'layout', category: 'ui' },
  { name: 'layout-sidebar-left', category: 'ui' },
  { name: 'layout-sidebar-right', category: 'ui' },
  { name: 'layout-panel', category: 'ui' },
  { name: 'split-horizontal', category: 'ui' },
  { name: 'split-vertical', category: 'ui' },
  { name: 'window', category: 'ui' },
  { name: 'browser', category: 'ui' },
  { name: 'preview', category: 'ui' },
  { name: 'bell', category: 'ui' },
  { name: 'bell-dot', category: 'ui' },
  { name: 'info', category: 'ui' },
  { name: 'warning', category: 'ui' },
  { name: 'error', category: 'ui' },
  { name: 'question', category: 'ui' },

  // git
  { name: 'git-branch', category: 'git' },
  { name: 'git-commit', category: 'git' },
  { name: 'git-merge', category: 'git' },
  { name: 'git-compare', category: 'git' },
  { name: 'git-pull-request', category: 'git' },
  { name: 'git-fork', category: 'git' },
  { name: 'source-control', category: 'git' },
  { name: 'github', category: 'git' },
  { name: 'github-alt', category: 'git' },
  { name: 'github-inverted', category: 'git' },
  { name: 'repo', category: 'git' },
  { name: 'repo-clone', category: 'git' },
  { name: 'repo-forked', category: 'git' },
  { name: 'repo-pull', category: 'git' },
  { name: 'repo-push', category: 'git' },
  { name: 'cloud', category: 'git' },

  // debug
  { name: 'bug', category: 'debug' },
  { name: 'debug', category: 'debug' },
  { name: 'debug-alt', category: 'debug' },
  { name: 'debug-console', category: 'debug' },
  { name: 'debug-breakpoint', category: 'debug' },
  { name: 'debug-step-over', category: 'debug' },
  { name: 'debug-step-into', category: 'debug' },
  { name: 'debug-step-out', category: 'debug' },
  { name: 'debug-continue', category: 'debug' },
  { name: 'debug-disconnect', category: 'debug' },
  { name: 'beaker', category: 'debug' },

  // terminal
  { name: 'terminal', category: 'terminal' },
  { name: 'terminal-bash', category: 'terminal' },
  { name: 'terminal-cmd', category: 'terminal' },
  { name: 'terminal-powershell', category: 'terminal' },
  { name: 'terminal-linux', category: 'terminal' },
  { name: 'console', category: 'terminal' },
  { name: 'output', category: 'terminal' },
  { name: 'server', category: 'terminal' },
  { name: 'server-environment', category: 'terminal' },
  { name: 'server-process', category: 'terminal' },

  // editor
  { name: 'code', category: 'editor' },
  { name: 'json', category: 'editor' },
  { name: 'markdown', category: 'editor' },
  { name: 'note', category: 'editor' },
  { name: 'notebook', category: 'editor' },
  { name: 'pencil', category: 'editor' },
  { name: 'comment', category: 'editor' },
  { name: 'comment-discussion', category: 'editor' },
  { name: 'tag', category: 'editor' },
  { name: 'bookmark', category: 'editor' },
  { name: 'pin', category: 'editor' },
  { name: 'pinned', category: 'editor' },
  { name: 'history', category: 'editor' },
  { name: 'clock', category: 'editor' },
  { name: 'watch', category: 'editor' },
  { name: 'wand', category: 'editor' },
  { name: 'sparkle', category: 'editor' },
  { name: 'lightbulb', category: 'editor' },

  // media
  { name: 'image', category: 'media' },
  { name: 'video', category: 'media' },
  { name: 'play-circle', category: 'media' },
  { name: 'record', category: 'media' },
  { name: 'mute', category: 'media' },
  { name: 'unmute', category: 'media' },
  { name: 'megaphone', category: 'media' },
  { name: 'broadcast', category: 'media' },

  // misc
  { name: 'rocket', category: 'misc' },
  { name: 'star', category: 'misc' },
  { name: 'star-empty', category: 'misc' },
  { name: 'star-full', category: 'misc' },
  { name: 'heart', category: 'misc' },
  { name: 'flame', category: 'misc' },
  { name: 'zap', category: 'misc' },
  { name: 'globe', category: 'misc' },
  { name: 'book', category: 'misc' },
  { name: 'mortar-board', category: 'misc' },
  { name: 'tools', category: 'misc' },
  { name: 'package', category: 'misc' },
  { name: 'database', category: 'misc' },
  { name: 'extensions', category: 'misc' },
  { name: 'plug', category: 'misc' },
  { name: 'link', category: 'misc' },
  { name: 'link-external', category: 'misc' },
  { name: 'mail', category: 'misc' },
  { name: 'person', category: 'misc' },
  { name: 'organization', category: 'misc' },
  { name: 'account', category: 'misc' },
  { name: 'shield', category: 'misc' },
  { name: 'verified', category: 'misc' },
  { name: 'graph', category: 'misc' },
  { name: 'pulse', category: 'misc' },
  { name: 'flag', category: 'misc' },
  { name: 'inbox', category: 'misc' },
  { name: 'calendar', category: 'misc' },
  { name: 'location', category: 'misc' },
  { name: 'compass', category: 'misc' },
];

export const CODICON_CATEGORIES: CodiconCategory[] = [
  'actions', 'symbols', 'files', 'ui', 'git', 'debug', 'terminal', 'editor', 'media', 'misc',
];

export function searchCodicons(query: string, category?: CodiconCategory): Codicon[] {
  const q = query.trim().toLowerCase();
  return CODICONS.filter((c) => {
    if (category && c.category !== category) return false;
    if (!q) return true;
    return c.name.toLowerCase().includes(q);
  });
}

export function isKnownCodicon(name: string): boolean {
  return CODICONS.some((c) => c.name === name);
}
