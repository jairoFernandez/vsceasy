import * as fs from 'fs';
import * as path from 'path';

/** Files emitted into src/webview/components/. Names map 1:1 to template files. */
const COMPONENT_FILES = [
  'Button.tsx',
  'Input.tsx',
  'Field.tsx',
  'Card.tsx',
  'List.tsx',
  'index.ts',
  'components.css',
] as const;

export interface AddComponentsOptions {
  projectRoot: string;
  templatesRoot: string;
  /** Overwrite existing component files. Default false (idempotent). */
  force?: boolean;
}

export interface AddComponentsResult {
  created: string[];
  skipped: string[];
  /** Absolute path to the components dir. */
  dir: string;
}

/**
 * Scaffold a small library of theme-aware React components (Button, Input,
 * Field, Card, List) into src/webview/components/, styled with VS Code tokens.
 * Panel `--template` UIs import from here. Idempotent unless `force`.
 */
export function addComponents(opts: AddComponentsOptions): AddComponentsResult {
  const genDir = path.join(opts.templatesRoot, '_generators', 'components');
  const outDir = path.join(opts.projectRoot, 'src', 'webview', 'components');
  fs.mkdirSync(outDir, { recursive: true });

  const created: string[] = [];
  const skipped: string[] = [];

  for (const file of COMPONENT_FILES) {
    const src = path.join(genDir, `${file}.tpl`);
    const dest = path.join(outDir, file);
    if (fs.existsSync(dest) && !opts.force) {
      skipped.push(dest);
      continue;
    }
    fs.writeFileSync(dest, fs.readFileSync(src, 'utf8'));
    created.push(dest);
  }

  return { created, skipped, dir: outDir };
}

/** True when the components library has already been generated. */
export function componentsExist(projectRoot: string): boolean {
  return fs.existsSync(path.join(projectRoot, 'src', 'webview', 'components', 'index.ts'));
}
