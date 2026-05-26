import * as fs from 'fs';
import * as path from 'path';

export interface VsceasyConfig {
  publisher?: string;
  commandPrefix?: string;
  ui?: 'react';
  defaultIcon?: string;
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
  const match = src.match(/export\s+default\s+(\{[\s\S]*?\})\s*;?\s*$/m);
  if (!match) return {};
  try {
    const jsonish = match[1]
      .replace(/\/\/.*$/gm, '')
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/([{,]\s*)([A-Za-z_][\w]*)\s*:/g, '$1"$2":')
      .replace(/'/g, '"');
    return JSON.parse(jsonish) as VsceasyConfig;
  } catch {
    return {};
  }
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
