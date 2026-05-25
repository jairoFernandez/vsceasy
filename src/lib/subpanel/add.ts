import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { substitute } from '../scaffold';

export interface AddSubpanelOptions {
  /** Subpanel id — camelCase. Becomes file basename + view id suffix. */
  name: string;
  /** Section header shown in the sidebar. Defaults to PascalCase of name. */
  title?: string;
  /** Menu (activity bar container) this view lives in — basename in src/menus/. */
  menu: string;
  /** Generate a typed RPC API interface. Default true. */
  withApi?: boolean;
  projectRoot: string;
  templatesRoot: string;
  runGen?: boolean;
}

export interface AddSubpanelResult {
  created: string[];
  modified: string[];
  skipped: string[];
  genRan: boolean;
}

export function addSubpanel(opts: AddSubpanelOptions): AddSubpanelResult {
  const name = normalizeCamel(opts.name);
  if (!name) throw new Error(`Invalid webview view name: ${opts.name}`);
  if (!opts.menu) throw new Error('menu is required (target container)');
  const Pascal = name.charAt(0).toUpperCase() + name.slice(1);
  const title = opts.title ?? Pascal;
  const withApi = opts.withApi !== false;
  const apiName = `${Pascal}ViewApi`;

  const menuFile = path.join(opts.projectRoot, 'src', 'menus', `${opts.menu}.ts`);
  if (!fs.existsSync(menuFile)) {
    throw new Error(`Menu not found: src/menus/${opts.menu}.ts — run \`vsxf menu add\` first`);
  }

  const viewTs = path.join(opts.projectRoot, 'src', 'subpanels', `${name}.ts`);
  const uiDir = path.join(opts.projectRoot, 'src', 'webview', 'subpanels', name);
  const appTsx = path.join(uiDir, 'App.tsx');
  const mainTsx = path.join(uiDir, 'main.tsx');
  const apiPath = path.join(opts.projectRoot, 'src', 'shared', 'api.ts');

  if (fs.existsSync(viewTs)) throw new Error(`Webview view already exists: ${path.relative(opts.projectRoot, viewTs)}`);
  if (fs.existsSync(uiDir)) throw new Error(`Webview dir already exists: ${path.relative(opts.projectRoot, uiDir)}`);

  const genDir = path.join(opts.templatesRoot, '_generators', 'subpanel');
  const readTpl = (n: string) => fs.readFileSync(path.join(genDir, n), 'utf8');

  const vars: Record<string, string> = {
    name,
    Name: Pascal,
    title,
    menu: opts.menu,
    apiImport: withApi ? `import type { ${apiName} } from '../shared/api';\n` : '',
    apiGeneric: withApi ? `<${apiName}>` : '',
    rpcBlock: withApi ? `\n  rpc: (vscode) => ({\n    // add RPC handlers here\n  }),` : '',
    apiBlock: withApi
      ? `import { connectWebview } from '../../../shared/vsxf/client';\nimport type { ${apiName} } from '../../../shared/api';\n\nconst api = connectWebview<${apiName}>();\nvoid api;\n`
      : '',
  };

  const created: string[] = [];
  const modified: string[] = [];
  const skipped: string[] = [];

  fs.mkdirSync(path.dirname(viewTs), { recursive: true });
  fs.writeFileSync(viewTs, substitute(readTpl('subpanel.ts.tpl'), vars));
  created.push(viewTs);

  fs.mkdirSync(uiDir, { recursive: true });
  fs.writeFileSync(appTsx, substitute(readTpl('App.tsx.tpl'), vars));
  created.push(appTsx);
  fs.writeFileSync(mainTsx, substitute(readTpl('main.tsx.tpl'), vars));
  created.push(mainTsx);

  if (withApi) {
    appendApi(apiPath, apiName, created, modified, skipped);
  }

  let genRan = false;
  if (opts.runGen !== false) genRan = runGen(opts.projectRoot);

  return { created, modified, skipped, genRan };
}

function appendApi(apiPath: string, apiName: string, created: string[], modified: string[], skipped: string[]) {
  if (!fs.existsSync(apiPath)) {
    fs.mkdirSync(path.dirname(apiPath), { recursive: true });
    fs.writeFileSync(apiPath, `export interface ${apiName} {}\n`);
    created.push(apiPath);
    return;
  }
  const current = fs.readFileSync(apiPath, 'utf8');
  const re = new RegExp(`\\bexport\\s+interface\\s+${apiName}\\b`);
  if (re.test(current)) {
    skipped.push(`${apiPath} (interface ${apiName} already declared)`);
    return;
  }
  const sep = current.endsWith('\n') ? '\n' : '\n\n';
  fs.writeFileSync(apiPath, current + `${sep}export interface ${apiName} {}\n`);
  modified.push(apiPath);
}

function runGen(cwd: string): boolean {
  const tryRun = (cmd: string, args: string[]) => {
    const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
    return r.status === 0;
  };
  if (which('bun') && tryRun('bun', ['run', 'gen'])) return true;
  if (which('npm') && tryRun('npm', ['run', 'gen'])) return true;
  console.warn('\n! Could not run "gen" automatically. Run `bun run gen` manually.\n');
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
