import * as path from 'path';
import { select, askText, confirm, style } from '../interactive';
import { findProjectRoot, findTemplatesRoot } from '../findProject';
import { scaffold } from '../scaffold';
import { addPanel } from '../panel/add';
import { addCommand } from '../command/add';
import { addHelper, HELPER_KINDS, HelperKind } from '../helper/add';
import { addModel } from '../model/add';
import { parseFieldsSpec } from '../model/parseFields';
import { initDb, dbExists } from '../db/init';

const { GREEN, DIM, BOLD, RST, CYAN, YELLOW } = style;

/**
 * Interactive wizard. Detects whether the cwd is inside a vsceasy project:
 * outside → guides `create`; inside → menus the common generators and delegates
 * to the same lib functions the CLI commands use. Anything not wired here is
 * surfaced as the exact `vsceasy …` command to run.
 *
 * Designed for `findTemplatesRoot(__dirname)` to resolve the bundled templates
 * whether running from src/ or dist/.
 */
export async function runWizard(opts: { templatesRoot?: string; cwd?: string } = {}): Promise<void> {
  const templatesRoot = opts.templatesRoot ?? findTemplatesRoot(__dirname);
  const cwd = opts.cwd ?? process.cwd();

  let projectRoot: string | null = null;
  try {
    projectRoot = findProjectRoot(cwd);
  } catch {
    projectRoot = null;
  }

  console.log(`\n${BOLD}vsceasy${RST} ${DIM}— interactive wizard${RST}`);

  if (!projectRoot) {
    console.log(`${DIM}Not inside a vsceasy project.${RST}\n`);
    const start = await confirm('Create a new extension project here?', true);
    if (!start) {
      console.log('Nothing to do. Run `vsceasy create <name>` when ready.\n');
      return;
    }
    await wizardCreate(templatesRoot, cwd);
    return;
  }

  console.log(`${DIM}Project:${RST} ${path.relative(cwd, projectRoot) || '.'}\n`);
  await wizardInProject(projectRoot, templatesRoot);
}

type Action =
  | 'panel'
  | 'command'
  | 'model'
  | 'helper'
  | 'db'
  | 'more';

async function wizardInProject(projectRoot: string, templatesRoot: string): Promise<void> {
  const choice = await select<Action>(
    'What do you want to add?',
    [
      { label: 'Panel', value: 'panel', hint: 'webview + typed RPC' },
      { label: 'Command', value: 'command', hint: 'palette command' },
      { label: 'Database', value: 'db', hint: 'init the mini-ORM' },
      { label: 'Model', value: 'model', hint: 'entity + repo' },
      { label: 'Helper', value: 'helper', hint: 'secrets/config/state/…' },
      { label: 'Something else…', value: 'more', hint: 'show the full command list' },
    ],
    { filter: false },
  ).catch(() => null);

  if (choice == null) {
    console.log('Cancelled.\n');
    return;
  }

  switch (choice) {
    case 'panel':
      return wizardPanel(projectRoot, templatesRoot);
    case 'command':
      return wizardCommand(projectRoot, templatesRoot);
    case 'db':
      return wizardDb(projectRoot, templatesRoot);
    case 'model':
      return wizardModel(projectRoot, templatesRoot);
    case 'helper':
      return wizardHelper(projectRoot, templatesRoot);
    case 'more':
      return showMore();
  }
}

async function wizardCreate(templatesRoot: string, cwd: string): Promise<void> {
  const name = (await askText('Package name (e.g. my-extension)')).trim();
  if (!name) {
    console.log('A name is required.\n');
    return;
  }
  const simpleName = name.replace(/^@[^/]+\//, '');
  const displayName = (await askText('Display name', toTitle(simpleName))).trim();
  const publisher = (await askText('Publisher id', 'your-publisher')).trim();
  const preset = await select<'minimal' | 'full'>(
    'Preset',
    [
      { label: 'full', value: 'full', hint: 'panel + RPC sample' },
      { label: 'minimal', value: 'minimal', hint: 'empty extension' },
    ],
    { filter: false },
  ).catch(() => 'full' as const);

  const targetDir = path.resolve(cwd, simpleName);
  await scaffold({
    name,
    displayName: displayName || toTitle(simpleName),
    description: `${simpleName} VS Code extension`,
    publisher: publisher || 'your-publisher',
    ui: 'react',
    preset,
    targetDir,
    templatesRoot,
  });
  const rel = path.relative(cwd, targetDir) || '.';
  console.log(`\n${GREEN}✓${RST} Created ${name} at ${rel}\n`);
  console.log(`${DIM}Next:${RST} cd ${rel} && bun install && bun run dev\n`);
}

async function wizardPanel(projectRoot: string, templatesRoot: string): Promise<void> {
  const name = (await askText('Panel id (e.g. settings)')).trim();
  if (!name) return cancel();
  const title = (await askText('Tab title', toTitle(name))).trim();
  const withApi = await confirm('Generate a typed RPC API for it?', true);
  const result = addPanel({ name, title: title || undefined, withApi, projectRoot, templatesRoot, runGen: false });
  report(projectRoot, 'Panel', result.created, result.modified, result.skipped);
  hintGen(result.genRan);
}

async function wizardCommand(projectRoot: string, templatesRoot: string): Promise<void> {
  const name = (await askText('Command id (e.g. sayHello)')).trim();
  if (!name) return cancel();
  const title = (await askText('Title shown in palette', toTitle(name))).trim();
  const result = addCommand({ name, title: title || undefined, projectRoot, templatesRoot, runGen: false });
  report(projectRoot, 'Command', result.created, result.modified, []);
  hintGen(result.genRan);
}

async function wizardDb(projectRoot: string, templatesRoot: string): Promise<void> {
  if (dbExists(projectRoot)) {
    console.log(`${DIM}Database already initialized (src/helpers/db.ts).${RST}\n`);
    return;
  }
  const provider = await select<'storage' | 'global'>(
    'Storage provider',
    [
      { label: 'storage', value: 'storage', hint: 'per-workspace storage dir' },
      { label: 'global', value: 'global', hint: 'shared across workspaces' },
    ],
    { filter: false },
  ).catch(() => 'storage' as const);
  const result = initDb({ projectRoot, templatesRoot, provider });
  report(projectRoot, 'Database', result.created, [], result.skipped);
  console.log(`${DIM}Next:${RST} add a model — re-run the wizard and pick Model.\n`);
}

async function wizardModel(projectRoot: string, templatesRoot: string): Promise<void> {
  if (!dbExists(projectRoot)) {
    console.log(`${YELLOW}!${RST} No database yet. Pick Database first, then add a model.\n`);
    return;
  }
  const name = (await askText('Model name (e.g. user)')).trim();
  if (!name) return cancel();
  console.log(
    `\n  ${DIM}Field spec: comma-separated \`name:type\` — flags: ${RST}` +
      `${CYAN}!${RST}${DIM} primary ${RST}${CYAN}@${RST}${DIM} indexed ${RST}${CYAN}?${RST}${DIM} optional${RST}`,
  );
  console.log(`  ${DIM}Example:${RST} id:string!,name:string,email?:string@,createdAt:number\n`);
  const spec = (await askText('Fields')).trim();
  if (!spec) {
    console.log('At least one field is required.\n');
    return;
  }
  let fields;
  try {
    fields = parseFieldsSpec(spec);
  } catch (err: any) {
    console.log(`${YELLOW}!${RST} ${err.message}\n`);
    return;
  }
  const result = addModel({ name, fields, projectRoot, templatesRoot });
  console.log(
    `\n${GREEN}✓${RST} Model created (primaryKey: ${result.primaryKey}` +
      `${result.indexes.length ? `, indexes: ${result.indexes.join(', ')}` : ''}).\n`,
  );
  for (const f of result.created) console.log(`  + ${path.relative(projectRoot, f)}`);
  console.log('');
}

async function wizardHelper(projectRoot: string, templatesRoot: string): Promise<void> {
  const kind = await select<HelperKind>(
    'Helper kind',
    HELPER_KINDS.map((k) => ({ label: k, value: k })),
    { filter: false },
  ).catch(() => null);
  if (kind == null) return cancel();
  let force = false;
  const result = addHelper({ kind, force, projectRoot, templatesRoot });
  if (result.skipped.length) {
    force = await confirm(`${kind} already exists. Overwrite?`, false);
    if (force) {
      const forced = addHelper({ kind, force: true, projectRoot, templatesRoot });
      report(projectRoot, 'Helper', forced.created, [], forced.skipped);
      return;
    }
  }
  report(projectRoot, 'Helper', result.created, [], result.skipped);
}

function showMore(): void {
  console.log(`\n${BOLD}Other generators${RST} ${DIM}(run directly)${RST}`);
  const rows: [string, string][] = [
    ['vsceasy menu add', 'sidebar activity-bar tree view'],
    ['vsceasy treeview add', 'data-driven tree view'],
    ['vsceasy subpanel add', 'inline webview section in a menu'],
    ['vsceasy statusBar add', 'status bar item'],
    ['vsceasy rpc add', 'typed RPC method on a panel'],
    ['vsceasy crud add', 'full CRUD UI for a model'],
    ['vsceasy job add', 'recurring / event-triggered job'],
    ['vsceasy test setup', 'Vitest scaffolding'],
    ['vsceasy publish init', 'marketplace publish helpers'],
    ['vsceasy doctor', 'diagnose project drift'],
    ['vsceasy upgrade', 'sync framework runtime files'],
  ];
  const w = Math.max(...rows.map(([c]) => c.length));
  for (const [cmd, desc] of rows) {
    console.log(`  ${CYAN}${cmd.padEnd(w)}${RST}  ${DIM}${desc}${RST}`);
  }
  console.log('');
}

// ── helpers ──────────────────────────────────────────────────────────────────

function cancel(): void {
  console.log('Cancelled.\n');
}

function report(
  projectRoot: string,
  label: string,
  created: string[],
  modified: string[],
  skipped: string[],
): void {
  const rel = (p: string) => path.relative(projectRoot, p);
  console.log(`\n${GREEN}✓${RST} ${label} ready.\n`);
  for (const f of created) console.log(`  ${GREEN}+${RST} ${rel(f)}`);
  for (const f of modified) console.log(`  ${YELLOW}~${RST} ${rel(f)}`);
  for (const f of skipped) console.log(`  ${DIM}· ${rel(f)} (skipped)${RST}`);
  console.log('');
}

function hintGen(genRan: boolean): void {
  console.log(
    genRan
      ? `${DIM}Registry + package.json updated. Run \`bun run launch\` to try it.${RST}\n`
      : `${DIM}Run \`bun run gen\` to wire it up, then \`bun run launch\`.${RST}\n`,
  );
}

function toTitle(s: string): string {
  return s
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
