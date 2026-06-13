/**
 * Sync the live-preview component sources from the single source of truth:
 * the CLI's generator templates. The docs do NOT keep their own copy — these
 * files are generated (and gitignored) so the preview always shows exactly what
 * `vsceasy components add` writes into a real project.
 *
 * The component templates are plain TSX/CSS with no placeholders, so syncing is
 * a copy that strips the `.tpl` suffix. Runs before `dev` and `build`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../../templates/_generators/components');
const dest = path.resolve(here, '../src/components/vsceasy/generated');

const FILES = ['Button.tsx', 'Input.tsx', 'Field.tsx', 'Card.tsx', 'List.tsx', 'components.css'];

fs.mkdirSync(dest, { recursive: true });

const banner = '/* AUTO-GENERATED from templates/_generators/components — do not edit. Run `bun run sync:components`. */\n';

let copied = 0;
for (const file of FILES) {
  const from = path.join(src, `${file}.tpl`);
  const to = path.join(dest, file);
  if (!fs.existsSync(from)) {
    throw new Error(`Missing component template: ${from}`);
  }
  const body = fs.readFileSync(from, 'utf8');
  // Prefix a banner so it's obvious these are generated. CSS + TS both accept /* */.
  fs.writeFileSync(to, banner + body);
  copied++;
}

console.log(`✓ synced ${copied} component file(s) from templates → src/components/vsceasy/generated`);
