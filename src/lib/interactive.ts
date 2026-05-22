import * as readline from 'readline';

const ESC = '\x1b';
const DIM = `${ESC}[2m`;
const BOLD = `${ESC}[1m`;
const CYAN = `${ESC}[36m`;
const GREEN = `${ESC}[32m`;
const YELLOW = `${ESC}[33m`;
const INV = `${ESC}[7m`;
const RST = `${ESC}[0m`;

export const style = { DIM, BOLD, CYAN, GREEN, YELLOW, INV, RST };

function rl() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

export async function askText(question: string, defaultValue?: string): Promise<string> {
  const r = rl();
  const hint = defaultValue ? ` ${DIM}[${defaultValue}]${RST}` : '';
  return new Promise((resolve) => {
    r.question(`${CYAN}?${RST} ${question}${hint}: `, (ans) => {
      r.close();
      const v = (ans ?? '').trim();
      resolve(v.length ? v : (defaultValue ?? ''));
    });
  });
}

export interface ListOption<T = unknown> {
  label: string;
  value: T;
  hint?: string;
  /** Optional indicator/glyph shown before label. */
  badge?: string;
  /** Disable selection. */
  disabled?: boolean;
}

export interface SelectOptions {
  /** Show search-filter input. Default: auto (>8 items). */
  filter?: boolean;
  /** Max rows visible before scroll. Default: 10. */
  pageSize?: number;
  /** Pre-render block (header above the list). */
  header?: string;
}

const isInteractive = (): boolean => Boolean(process.stdin.isTTY && process.stdout.isTTY);

export async function select<T>(
  question: string,
  options: ListOption<T>[],
  opts: SelectOptions = {},
): Promise<T> {
  if (options.length === 0) throw new Error(`No options for: ${question}`);
  if (!isInteractive()) return selectNumbered(question, options, opts);
  return selectArrow(question, options, opts);
}

async function selectNumbered<T>(question: string, options: ListOption<T>[], opts: SelectOptions): Promise<T> {
  if (opts.header) console.log(opts.header);
  console.log(`\n${CYAN}?${RST} ${BOLD}${question}${RST}`);
  options.forEach((opt, i) => {
    const hint = opt.hint ? `  ${DIM}${opt.hint}${RST}` : '';
    const badge = opt.badge ? `${opt.badge} ` : '';
    console.log(`  ${String(i + 1).padStart(2)}) ${badge}${opt.label}${hint}`);
  });
  while (true) {
    const ans = await askText('Select #', '1');
    const n = Number(ans);
    if (Number.isInteger(n) && n >= 1 && n <= options.length && !options[n - 1].disabled) {
      return options[n - 1].value;
    }
    console.log(`Invalid choice.`);
  }
}

async function selectArrow<T>(question: string, options: ListOption<T>[], opts: SelectOptions): Promise<T> {
  const pageSize = opts.pageSize ?? 10;
  const useFilter = opts.filter ?? options.length > 8;
  let filter = '';
  let index = 0;

  const visible = () => options.filter((o) => !filter || o.label.toLowerCase().includes(filter.toLowerCase()) || (o.hint?.toLowerCase().includes(filter.toLowerCase()) ?? false));
  const clampIdx = () => { const v = visible(); if (index >= v.length) index = Math.max(0, v.length - 1); };

  return new Promise<T>((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let lastLines = 0;

    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const cleanup = () => {
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
      stdin.removeListener('data', onData);
    };

    const erase = () => {
      if (lastLines > 0) {
        stdout.write(`${ESC}[${lastLines}A`); // up
        stdout.write(`${ESC}[J`); // clear to end
      }
    };

    const render = () => {
      erase();
      const lines: string[] = [];
      if (opts.header) lines.push(...opts.header.split('\n'));
      const hint = useFilter
        ? `  ${DIM}(↑↓ move, type to filter, enter to select, esc to cancel)${RST}`
        : `  ${DIM}(↑↓ move, enter to select, esc to cancel)${RST}`;
      lines.push(`${CYAN}?${RST} ${BOLD}${question}${RST}${hint}`);
      if (useFilter) {
        lines.push(`  ${DIM}filter:${RST} ${filter || `${DIM}(none)${RST}`}`);
      }
      const v = visible();
      if (v.length === 0) {
        lines.push(`  ${DIM}(no matches)${RST}`);
      } else {
        const start = Math.max(0, Math.min(index - Math.floor(pageSize / 2), v.length - pageSize));
        const end = Math.min(v.length, start + pageSize);
        for (let i = start; i < end; i++) {
          const opt = v[i];
          const isCur = i === index;
          const pointer = isCur ? `${GREEN}❯${RST}` : ' ';
          const badge = opt.badge ? `${opt.badge} ` : '';
          const labelStyled = opt.disabled
            ? `${DIM}${opt.label}${RST}`
            : isCur ? `${BOLD}${opt.label}${RST}` : opt.label;
          const optHint = opt.hint ? `  ${DIM}${opt.hint}${RST}` : '';
          lines.push(`${pointer} ${badge}${labelStyled}${optHint}`);
        }
        if (v.length > pageSize) {
          lines.push(`  ${DIM}${index + 1}/${v.length}${RST}`);
        }
      }
      const out = lines.join('\n') + '\n';
      stdout.write(out);
      lastLines = lines.length;
    };

    const onData = (data: string) => {
      // Ctrl-C
      if (data === '\x03') { erase(); cleanup(); reject(new Error('Cancelled')); return; }
      // Esc
      if (data === '\x1b') { erase(); cleanup(); reject(new Error('Cancelled')); return; }
      // Enter
      if (data === '\r' || data === '\n') {
        const v = visible();
        if (v.length === 0 || v[index]?.disabled) return;
        erase();
        cleanup();
        // Reprint final selection summary
        stdout.write(`${CYAN}?${RST} ${BOLD}${question}${RST} ${GREEN}${v[index].label}${RST}\n`);
        resolve(v[index].value);
        return;
      }
      // Backspace
      if (data === '\x7f' || data === '\b') {
        if (useFilter && filter.length) { filter = filter.slice(0, -1); index = 0; clampIdx(); render(); }
        return;
      }
      // Arrow keys: \x1b[A up, \x1b[B down
      if (data === '\x1b[A') { const v = visible(); if (v.length) { index = (index - 1 + v.length) % v.length; render(); } return; }
      if (data === '\x1b[B') { const v = visible(); if (v.length) { index = (index + 1) % v.length; render(); } return; }
      if (data === '\x1b[H' || data === '\x1b[1~') { index = 0; render(); return; }
      if (data === '\x1b[F' || data === '\x1b[4~') { index = Math.max(0, visible().length - 1); render(); return; }
      // Printable typed → filter
      if (useFilter && data >= ' ' && data <= '~') {
        filter += data;
        index = 0;
        clampIdx();
        render();
        return;
      }
    };

    stdin.on('data', onData);
    render();
  });
}

/** Confirm yes/no with arrow keys. */
export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  return select<boolean>(question, [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ], { filter: false }).then((v) => v).catch(() => defaultYes);
}
