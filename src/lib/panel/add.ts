import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { substitute } from '../scaffold';
import { assertId, assertNoOverwrite } from '../validate';
import { addComponents, componentsExist } from '../components/add';

export type PanelTemplate = 'blank' | 'form' | 'list' | 'dashboard';
export const PANEL_TEMPLATES: PanelTemplate[] = ['blank', 'form', 'list', 'dashboard'];

export interface AddPanelOptions {
  /** Panel id — camelCase recommended. */
  name: string;
  /** Tab title shown in VS Code. Defaults to PascalCase of name. */
  title?: string;
  /** Generate a typed RPC API interface in src/shared/api.ts. Default true. */
  withApi?: boolean;
  /**
   * Starter UI. `blank` = empty App.tsx. `form`/`list`/`dashboard` generate a
   * working UI built from src/webview/components (auto-generated if missing) and
   * wire matching RPC methods. Non-blank templates force `withApi` on. Default `blank`.
   */
  template?: PanelTemplate;
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
  const name = assertId('panel name', normalizeCamel(opts.name));
  const Pascal = name.charAt(0).toUpperCase() + name.slice(1);
  const title = opts.title ?? Pascal;
  const template = opts.template ?? 'blank';
  if (!PANEL_TEMPLATES.includes(template)) {
    throw new Error(`Unknown panel template "${template}". Available: ${PANEL_TEMPLATES.join(', ')}.`);
  }
  // Non-blank templates are RPC-driven — force the API on regardless of withApi.
  const withApi = template !== 'blank' ? true : opts.withApi !== false;
  const apiName = `${Pascal}Api`;

  const panelTs = path.join(opts.projectRoot, 'src', 'panels', `${name}.ts`);
  const uiDir = path.join(opts.projectRoot, 'src', 'webview', 'panels', name);
  const appTsx = path.join(uiDir, 'App.tsx');
  const mainTsx = path.join(uiDir, 'main.tsx');
  const apiPath = path.join(opts.projectRoot, 'src', 'shared', 'api.ts');

  assertNoOverwrite(opts.projectRoot, panelTs, 'Panel');
  assertNoOverwrite(opts.projectRoot, uiDir, 'Webview dir');

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
      ? `import { connectWebview } from '../../../shared/vsceasy/client';\nimport type { ${apiName} } from '../../../shared/api';\n\nconst api = connectWebview<${apiName}>();\nvoid api;\n`
      : '',
  };

  const created: string[] = [];
  const modified: string[] = [];
  const skipped: string[] = [];

  // Non-blank templates depend on the shared component library.
  if (template !== 'blank' && !componentsExist(opts.projectRoot)) {
    const comp = addComponents({ projectRoot: opts.projectRoot, templatesRoot: opts.templatesRoot });
    created.push(...comp.created);
  }

  fs.mkdirSync(path.dirname(panelTs), { recursive: true });
  fs.writeFileSync(panelTs, substitute(readTpl('panel.ts.tpl'), vars));
  created.push(panelTs);

  fs.mkdirSync(uiDir, { recursive: true });
  const appSrc =
    template === 'blank'
      ? readTpl('App.tsx.tpl')
      : fs.readFileSync(path.join(genDir, 'templates', template, 'App.tsx.tpl'), 'utf8');
  fs.writeFileSync(appTsx, substitute(appSrc, { ...vars, ...TEMPLATE_VARS[template] }));
  created.push(appTsx);
  fs.writeFileSync(mainTsx, substitute(readTpl('main.tsx.tpl'), vars));
  created.push(mainTsx);

  if (withApi) {
    appendApi(apiPath, apiName, API_BODY[template], created, modified, skipped);
  }

  let genRan = false;
  if (opts.runGen !== false) {
    genRan = runGen(opts.projectRoot);
  }

  return { created, modified, skipped, genRan };
}

function appendApi(apiPath: string, apiName: string, body: string, created: string[], modified: string[], skipped: string[]) {
  const decl = `export interface ${apiName} {${body}}\n`;
  if (!fs.existsSync(apiPath)) {
    fs.mkdirSync(path.dirname(apiPath), { recursive: true });
    fs.writeFileSync(apiPath, decl);
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
  fs.writeFileSync(apiPath, current + sep + decl);
  modified.push(apiPath);
}

/** RPC interface bodies per template. Empty for blank (renders `{}`). */
const API_BODY: Record<PanelTemplate, string> = {
  blank: '',
  form: '\n  save(input: { name: string; email: string }): Promise<void>;\n',
  list: '\n  list(): Promise<{ id: string; label: string }[]>;\n',
  dashboard: '\n  stats(): Promise<{ total: number; active: number; updatedAt: string }>;\n',
};

/** App.tsx body substitutions per template (the RPC call site). */
const TEMPLATE_VARS: Record<PanelTemplate, Record<string, string>> = {
  blank: {},
  form: { submitCall: 'await api.save({ name, email });' },
  list: { loadCall: 'setRows(await api.list());' },
  dashboard: { statsCall: 'setStats(await api.stats());' },
};

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
