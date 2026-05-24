import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { substitute } from './scaffold';
import { addCommand } from './addCommand';

export interface AddStatusBarOptions {
  name: string;
  text: string;
  alignment?: 'left' | 'right';
  priority?: number;
  tooltip?: string;
  tooltipMarkdown?: string;
  icon?: string;
  /** Existing command id (basename in src/commands/) OR full vscode command id. */
  command?: string;
  /** Panel id (basename in src/panels/). Takes precedence over command when set. */
  panel?: string;
  /** QuickPick menu items shown on click. Overrides command/panel when set. */
  menu?: Array<{ label: string; description?: string; detail?: string; command?: string; panel?: string; url?: string }>;
  /** When set, bootstraps a new command via addCommand lib and binds it. */
  newCommandTitle?: string;
  projectRoot: string;
  templatesRoot: string;
  runGen?: boolean;
}

export interface AddStatusBarResult {
  created: string[];
  commandCreated?: string;
  genRan: boolean;
}

export function addStatusBar(opts: AddStatusBarOptions): AddStatusBarResult {
  const name = normalizeCamel(opts.name);
  if (!name) throw new Error(`Invalid status bar name: ${opts.name}`);

  const file = path.join(opts.projectRoot, 'src', 'statusBars', `${name}.ts`);
  if (fs.existsSync(file)) {
    throw new Error(`Status bar already exists: ${path.relative(opts.projectRoot, file)}`);
  }

  const tplPath = path.join(opts.templatesRoot, '_generators', 'statusBar', 'statusBar.ts.tpl');
  if (!fs.existsSync(tplPath)) throw new Error(`Template missing: ${tplPath}`);

  // Bootstrap a new command if requested
  let commandId: string | undefined = opts.command;
  let commandCreated: string | undefined;
  if (opts.newCommandTitle) {
    const cmdId = `${name}Action`;
    addCommand({
      name: cmdId,
      title: opts.newCommandTitle,
      projectRoot: opts.projectRoot,
      templatesRoot: opts.templatesRoot,
      runGen: false,
    });
    commandId = cmdId;
    commandCreated = cmdId;
  }

  const text = opts.text ?? '';
  const alignment = opts.alignment ?? 'left';
  const priority = String(opts.priority ?? 100);

  const vars: Record<string, string> = {
    name,
    text: escapeSingleQuotes(text),
    alignment,
    priority,
    iconLine: opts.icon ? `\n  icon: '${escapeSingleQuotes(opts.icon)}',` : '',
    tooltipLine: opts.tooltipMarkdown
      ? `\n  tooltipMarkdown: ${asBacktickString(opts.tooltipMarkdown)},`
      : opts.tooltip
        ? `\n  tooltip: '${escapeSingleQuotes(opts.tooltip)}',`
        : '',
    commandLine: !opts.panel && !opts.menu && commandId ? `\n  command: '${escapeSingleQuotes(commandId)}',` : '',
    panelLine: opts.panel && !opts.menu ? `\n  panel: '${escapeSingleQuotes(opts.panel)}',` : '',
  };

  // menu line built via JSON5-ish object literal; injected manually
  if (opts.menu && opts.menu.length > 0) {
    const itemLines = opts.menu
      .map((it) => {
        const fields: string[] = [`label: '${escapeSingleQuotes(it.label)}'`];
        if (it.description) fields.push(`description: '${escapeSingleQuotes(it.description)}'`);
        if (it.detail) fields.push(`detail: '${escapeSingleQuotes(it.detail)}'`);
        if (it.command) fields.push(`command: '${escapeSingleQuotes(it.command)}'`);
        if (it.panel) fields.push(`panel: '${escapeSingleQuotes(it.panel)}'`);
        if (it.url) fields.push(`url: '${escapeSingleQuotes(it.url)}'`);
        return `    { ${fields.join(', ')} },`;
      })
      .join('\n');
    vars.panelLine += `\n  menu: [\n${itemLines}\n  ],`;
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, substitute(fs.readFileSync(tplPath, 'utf8'), vars));

  let genRan = false;
  if (opts.runGen !== false) genRan = runGen(opts.projectRoot);

  return { created: [file], commandCreated, genRan };
}

function escapeSingleQuotes(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function asBacktickString(s: string): string {
  return '`' + s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
}

function runGen(cwd: string): boolean {
  const tryRun = (cmd: string, args: string[]) => {
    const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
    return r.status === 0;
  };
  if (which('bun') && tryRun('bun', ['run', 'gen'])) return true;
  if (which('npm') && tryRun('npm', ['run', 'gen'])) return true;
  return false;
}

function which(cmd: string): boolean {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' });
  return r.status === 0;
}

function normalizeCamel(s: string): string {
  const cleaned = s.trim().replace(/[^a-zA-Z0-9]+(.)/g, (_m, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '');
  if (!cleaned) return '';
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}
