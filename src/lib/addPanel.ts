import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { substitute } from './scaffold';

export interface AddPanelOptions {
  /** Panel id — camelCase recommended. */
  name: string;
  /** Tab title shown in VS Code. Defaults to PascalCase of name. */
  title?: string;
  /** Generate a typed RPC API interface in src/shared/api.ts. Default true. */
  withApi?: boolean;
  /** Project root (output of findProjectRoot). */
  projectRoot: string;
  /** Bundled templates root (output of findTemplatesRoot). */
  templatesRoot: string;
  /** Run `bun run gen` after writing files. Default true. */
  runGen?: boolean;
}

export interface AddPanelResult {
  created: string[];
  modified: string[];
  skipped: string[];
  genRan: boolean;
}

export function addPanel(opts: AddPanelOptions): AddPanelResult {
  const name = normalizeCamel(opts.name);
  if (!name) throw new Error(`Invalid panel name: ${opts.name}`);
  const Pascal = name.charAt(0).toUpperCase() + name.slice(1);
  const title = opts.title ?? Pascal;
  const withApi = opts.withApi !== false;
  const apiName = `${Pascal}Api`;

  const panelTs = path.join(opts.projectRoot, 'src', 'panels', `${name}.ts`);
  const uiDir = path.join(opts.projectRoot, 'src', 'webview', 'panels', name);
  const appTsx = path.join(uiDir, 'App.tsx');
  const mainTsx = path.join(uiDir, 'main.tsx');
  const apiPath = path.join(opts.projectRoot, 'src', 'shared', 'api.ts');

  if (fs.existsSync(panelTs)) throw new Error(`Panel already exists: ${path.relative(opts.projectRoot, panelTs)}`);
  if (fs.existsSync(uiDir)) throw new Error(`Webview dir already exists: ${path.relative(opts.projectRoot, uiDir)}`);

  const genDir = path.join(opts.templatesRoot, '_generators', 'panel');
  const readTpl = (n: string) => fs.readFileSync(path.join(genDir, n), 'utf8');

  const vars: Record<string, string> = {
    name,
    Name: Pascal,
    title,
    api: withApi ? apiName : '',
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

  fs.mkdirSync(path.dirname(panelTs), { recursive: true });
  fs.writeFileSync(panelTs, substitute(readTpl('panel.ts.tpl'), vars));
  created.push(panelTs);

  fs.mkdirSync(uiDir, { recursive: true });
  fs.writeFileSync(appTsx, substitute(readTpl('App.tsx.tpl'), vars));
  created.push(appTsx);
  fs.writeFileSync(mainTsx, substitute(readTpl('main.tsx.tpl'), vars));
  created.push(mainTsx);

  if (withApi) {
    appendApi(apiPath, apiName, created, modified, skipped);
  }

  let genRan = false;
  if (opts.runGen !== false) {
    genRan = runGen(opts.projectRoot);
  }

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
  console.warn('\n! Could not run "gen" automatically. Run `bun run gen` (or `npm run gen`) manually to wire up the new panel.\n');
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
