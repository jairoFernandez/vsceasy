import { select, askText, style } from './interactive';
import { CODICONS, CODICON_CATEGORIES, CodiconCategory, isKnownCodicon } from '../data/codicons';

export interface IconPickerOptions {
  /** Called once before each step. Use to redraw header/preview. */
  onBeforeStep?: (label: string) => void;
  /** Allow returning '' (no icon). Default true. */
  allowNone?: boolean;
}

export async function pickIcon(opts: IconPickerOptions = {}): Promise<string> {
  const allowNone = opts.allowNone !== false;
  opts.onBeforeStep?.('Choose icon');
  const choices: { label: string; value: 'category' | 'all' | 'custom' | 'none'; hint?: string }[] = [
    { label: 'Browse by category', value: 'category', hint: '10 groups' },
    { label: 'Search all icons', value: 'all', hint: `${CODICONS.length}+ codicons, type to filter` },
    { label: 'Type custom codicon name', value: 'custom' },
  ];
  if (allowNone) choices.push({ label: 'No icon', value: 'none' });
  const mode = await select<'category' | 'all' | 'custom' | 'none'>('Icon?', choices);
  if (mode === 'none') return '';
  if (mode === 'custom') {
    opts.onBeforeStep?.('Type custom codicon');
    const name = await askText('Codicon name');
    if (name && !isKnownCodicon(name)) {
      console.log(`  ${style.DIM}(note: "${name}" not in bundled list — assuming valid)${style.RST}`);
    }
    return name;
  }
  let pool = CODICONS;
  if (mode === 'category') {
    opts.onBeforeStep?.('Pick icon category');
    const cat = await select<CodiconCategory>('Category?', CODICON_CATEGORIES.map((c) => ({
      label: c, value: c, hint: `${CODICONS.filter((x) => x.category === c).length} icons`,
    })));
    pool = CODICONS.filter((c) => c.category === cat);
  }
  opts.onBeforeStep?.(mode === 'all' ? 'Search icon' : 'Pick icon');
  return select<string>('Icon (type to filter)', pool.map((c) => ({
    label: c.name,
    value: c.name,
    hint: c.category,
  })), { filter: true, pageSize: 12 });
}
