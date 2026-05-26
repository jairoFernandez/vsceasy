import * as fs from 'fs';
import * as path from 'path';

export interface VsceasyConfig {
  publisher?: string;
  commandPrefix?: string;
  ui?: 'react';
  defaultIcon?: string;
  defaultCategory?: string;
}

const CONFIG_FILES = ['vsceasy.config.ts', 'vsceasy.config.js', 'vsceasy.config.json'];

export function configPath(projectRoot: string): string | null {
  for (const f of CONFIG_FILES) {
    const p = path.join(projectRoot, f);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function readConfig(projectRoot: string): VsceasyConfig {
  const p = configPath(projectRoot);
  if (!p) return {};
  try {
    if (p.endsWith('.json')) {
      return JSON.parse(fs.readFileSync(p, 'utf8')) as VsceasyConfig;
    }
    const src = fs.readFileSync(p, 'utf8');
    return parseExportDefault(src);
  } catch {
    return {};
  }
}

function parseExportDefault(src: string): VsceasyConfig {
  // Try inline form first: `export default { ... }`
  let literal = extractBracedLiteral(src, /export\s+default\s*\{/);
  // Fall back to: `const X(:Type)? = { ... }; export default X;`
  if (!literal) {
    literal = extractBracedLiteral(src, /(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*(?::\s*[^=]+)?=\s*\{/);
  }
  if (!literal) return {};
  try {
    const jsonish = literal
      .replace(/\/\/.*$/gm, '')
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/([{,]\s*)([A-Za-z_][\w]*)\s*:/g, '$1"$2":')
      .replace(/'/g, '"');
    return JSON.parse(jsonish) as VsceasyConfig;
  } catch {
    return {};
  }
}

function extractBracedLiteral(src: string, head: RegExp): string | null {
  const m = head.exec(src);
  if (!m) return null;
  const openIdx = m.index + m[0].length - 1; // position of `{`
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  return null;
}

export function writeConfig(projectRoot: string, cfg: VsceasyConfig): string {
  const target = path.join(projectRoot, 'vsceasy.config.ts');
  const body = `import type { VsceasyConfig } from 'vsceasy';

const config: VsceasyConfig = ${stringify(cfg)};

export default config;
`;
  fs.writeFileSync(target, body);
  return target;
}

function stringify(obj: Record<string, unknown> | VsceasyConfig): string {
  const entries = Object.entries(obj as Record<string, unknown>).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '{}';
  const lines = entries.map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`);
  return `{\n${lines.join('\n')}\n}`;
}
