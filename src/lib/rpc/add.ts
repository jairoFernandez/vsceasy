import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { assertId, assertSiblingExists } from '../validate';

export interface AddRpcMethodOptions {
  /** Panel id (basename in src/panels/). */
  panel: string;
  /** Method name (camelCase). */
  method: string;
  /** Raw TS parameter list (e.g. "pattern: string, limit?: number"). Empty for none. */
  paramSig?: string;
  /** Return type (e.g. "string[]"). Defaults to "void". Wrapped in Promise<>. */
  returns?: string;
  projectRoot: string;
  /** Run `bun run gen` after writing. Default false (no contributes change). */
  runGen?: boolean;
}

export interface AddRpcMethodResult {
  apiFile: string;
  panelFile: string;
  interfaceCreated: boolean;
  rpcBlockCreated: boolean;
  webviewSnippet: string;
  genRan: boolean;
}

export function addRpcMethod(opts: AddRpcMethodOptions): AddRpcMethodResult {
  const panelId = assertId('panel id', opts.panel.trim());
  const method = assertId('method name', opts.method.trim());
  assertSiblingExists(opts.projectRoot, 'panel', panelId);
  const panelFile = path.join(opts.projectRoot, 'src', 'panels', `${panelId}.ts`);

  const apiFile = path.join(opts.projectRoot, 'src', 'shared', 'api.ts');
  if (!fs.existsSync(apiFile)) {
    throw new Error(
      `RPC contract file missing at \`src/shared/api.ts\`. Create it (an empty file is fine) and retry.`,
    );
  }

  const Pascal = panelId.charAt(0).toUpperCase() + panelId.slice(1);
  const apiName = `${Pascal}Api`;
  const paramSig = (opts.paramSig ?? '').trim();
  const rawReturn = (opts.returns ?? 'void').trim() || 'void';
  const returnType = /^Promise<.+>$/.test(rawReturn) ? rawReturn : `Promise<${rawReturn}>`;

  // ── 1. Update api.ts
  let apiSrc = fs.readFileSync(apiFile, 'utf8');
  const ifaceRange = findInterfaceRange(apiSrc, apiName);
  let interfaceCreated = false;
  if (ifaceRange) {
    const body = apiSrc.slice(ifaceRange.bodyStart, ifaceRange.bodyEnd);
    if (methodAlreadyDeclared(body, method)) {
      throw new Error(`Method "${method}" already declared in ${apiName}`);
    }
    const trimmedBody = body.replace(/\s+$/, '');
    const newBody = `${trimmedBody}\n  ${method}(${paramSig}): ${returnType};\n`;
    apiSrc = apiSrc.slice(0, ifaceRange.bodyStart) + newBody + apiSrc.slice(ifaceRange.bodyEnd);
  } else {
    interfaceCreated = true;
    const block = `\nexport interface ${apiName} {\n  ${method}(${paramSig}): ${returnType};\n}\n`;
    apiSrc = apiSrc.replace(/\s*$/, '') + '\n' + block;
  }
  fs.writeFileSync(apiFile, apiSrc);

  // ── 2. Update panel file
  let panelSrc = fs.readFileSync(panelFile, 'utf8');
  const argNames = parseArgNames(paramSig);
  const handlerBody =
    `    async ${method}(${argNames.join(', ')}) {\n` +
    `      // TODO: implement\n` +
    `      throw new Error('Not implemented');\n` +
    `    },`;

  // Ensure API import + generic
  if (!new RegExp(`\\b${apiName}\\b`).test(panelSrc)) {
    panelSrc = ensureApiImport(panelSrc, apiName);
    panelSrc = ensurePanelGeneric(panelSrc, apiName);
  }

  let rpcBlockCreated = false;
  const rpcRange = findRpcBodyRange(panelSrc);
  if (rpcRange) {
    const inner = panelSrc.slice(rpcRange.start, rpcRange.end).replace(/\s+$/, '');
    const newInner = `${inner}\n${handlerBody}\n  `;
    panelSrc = panelSrc.slice(0, rpcRange.start) + newInner + panelSrc.slice(rpcRange.end);
  } else {
    rpcBlockCreated = true;
    panelSrc = insertRpcBlock(panelSrc, handlerBody);
  }
  fs.writeFileSync(panelFile, panelSrc);

  const webviewSnippet = buildSnippet(method, argNames);

  let genRan = false;
  if (opts.runGen === true) genRan = runGen(opts.projectRoot);

  return { apiFile, panelFile, interfaceCreated, rpcBlockCreated, webviewSnippet, genRan };
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers

interface InterfaceRange {
  bodyStart: number; // first char after opening `{`
  bodyEnd: number;   // index of matching closing `}`
}

function findInterfaceRange(src: string, name: string): InterfaceRange | null {
  const re = new RegExp(`export\\s+interface\\s+${escapeRe(name)}\\b[^{]*\\{`, 'm');
  const m = re.exec(src);
  if (!m) return null;
  const bodyStart = m.index + m[0].length;
  const bodyEnd = findMatchingBrace(src, bodyStart);
  if (bodyEnd === -1) return null;
  return { bodyStart, bodyEnd };
}

function findRpcBodyRange(src: string): { start: number; end: number } | null {
  // matches `rpc: (vscode[, ctx]) => ({`
  const re = /\brpc\s*:\s*\([^)]*\)\s*=>\s*\(\s*\{/m;
  const m = re.exec(src);
  if (!m) return null;
  const start = m.index + m[0].length;
  const end = findMatchingBrace(src, start);
  if (end === -1) return null;
  return { start, end };
}

function findMatchingBrace(src: string, start: number): number {
  let depth = 1;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function methodAlreadyDeclared(interfaceBody: string, method: string): boolean {
  return new RegExp(`\\b${escapeRe(method)}\\s*\\(`).test(interfaceBody);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseArgNames(sig: string): string[] {
  if (!sig) return [];
  return sig
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const name = part.split(':')[0].trim();
      return name.replace(/\?$/, '').replace(/^\.\.\./, '');
    })
    .filter(Boolean);
}

function ensureApiImport(src: string, apiName: string): string {
  if (new RegExp(`from\\s+['"]\\.\\./shared/api['"]`).test(src)) {
    return src.replace(
      /import\s+type\s+\{([^}]*)\}\s+from\s+['"]\.\.\/shared\/api['"];/,
      (_m, group) => {
        const names = new Set(group.split(',').map((n: string) => n.trim()).filter(Boolean));
        names.add(apiName);
        return `import type { ${[...names].join(', ')} } from '../shared/api';`;
      },
    );
  }
  const importLine = `import type { ${apiName} } from '../shared/api';\n`;
  // Insert after first import block
  const lastImport = src.match(/^(import[^\n]*\n)+/m);
  if (lastImport) {
    const end = lastImport.index! + lastImport[0].length;
    return src.slice(0, end) + importLine + src.slice(end);
  }
  return importLine + src;
}

function ensurePanelGeneric(src: string, apiName: string): string {
  return src.replace(/definePanel\s*(<[^>]+>)?\s*\(/, (_m, generic) => {
    return generic ? `definePanel${generic}(` : `definePanel<${apiName}>(`;
  });
}

function insertRpcBlock(src: string, handlerBody: string): string {
  // Insert rpc block after `title: '...'`, line
  const block = `\n  rpc: (vscode) => ({\n${handlerBody}\n  }),`;
  if (/title\s*:\s*['"][^'"]*['"]\s*,/.test(src)) {
    return src.replace(/(title\s*:\s*['"][^'"]*['"]\s*,)/, `$1${block}`);
  }
  // Fallback: insert before closing `});`
  return src.replace(/\}\s*\)\s*;?\s*$/, `${block}\n});\n`);
}

function buildSnippet(method: string, argNames: string[]): string {
  const args = argNames.length ? argNames.join(', ') : '';
  return `const result = await api.${method}(${args});`;
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
