import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { scaffold } from '../lib/scaffold';
import { findTemplatesRoot } from '../lib/findProject';
import { confirm } from '../lib/interactive';

const createCommand: Command = {
  name: 'create',
  description: 'Scaffold a new VS Code extension project',
  params: [
    { name: 'name', description: 'Extension package name (e.g. my-extension or @scope/my-ext)', required: true, type: ParamType.Text },
    { name: 'displayName', description: 'Human-readable extension name', required: false, type: ParamType.Text },
    { name: 'description', description: 'Short description', required: false, type: ParamType.Text },
    { name: 'publisher', description: 'VS Code publisher id', required: false, type: ParamType.Text },
    { name: 'ui', description: 'UI framework', required: false, type: ParamType.List, options: ['react'] },
    { name: 'preset', description: 'Project preset (minimal = empty extension, full = panel + RPC sample)', required: false, type: ParamType.List, options: ['minimal', 'full'] },
    { name: 'dir', description: 'Target directory (defaults to ./<name>)', required: false, type: ParamType.Text },
    { name: 'git', description: 'Initialize a git repository (skips the prompt)', required: false, type: ParamType.Boolean },
    { name: 'install', description: 'Install dependencies after scaffolding (skips the prompt)', required: false, type: ParamType.Boolean },
  ],
  action: async (args) => {
    const name: string = args.name;
    const simpleName = name.replace(/^@[^/]+\//, '');
    const ui = (args.ui ?? 'react') as 'react';
    const preset = (args.preset ?? 'full') as 'minimal' | 'full';
    const targetDir = path.resolve(process.cwd(), args.dir ?? simpleName);

    try {
      await scaffold({
        name,
        displayName: args.displayName ?? toTitle(simpleName),
        description: args.description ?? `${simpleName} VS Code extension`,
        publisher: args.publisher ?? 'your-publisher',
        ui,
        preset,
        targetDir,
        templatesRoot: findTemplatesRoot(),
      });
      const rel = path.relative(process.cwd(), targetDir) || '.';
      console.log(`\n✓ Created ${name} at ${rel}\n`);

      const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
      const gitFlag = toBool(args.git);
      const installFlag = toBool(args.install);

      // git init: explicit flag wins, else prompt when interactive
      const wantGit = gitFlag ?? (interactive ? await confirm('Initialize a git repository?', true) : false);
      if (wantGit) {
        if (which('git')) initGit(targetDir);
        else console.warn('! git not found — skipping repository init');
      }

      // dependency install: explicit flag wins, else prompt when interactive.
      // Resolve the package manager only when we actually intend to install.
      let pm: string | null = null;
      const wantInstall = installFlag ?? (interactive ? await confirm('Install dependencies?', true) : false);
      let installed = false;
      if (wantInstall) {
        pm = which('bun') ? 'bun' : which('npm') ? 'npm' : null;
        if (pm) installed = runInstall(pm, targetDir);
        else console.warn('! No package manager (bun/npm) found — skipping install');
      }

      const run = pm ?? 'bun';
      console.log('\nNext steps:');
      console.log(`  cd ${rel}`);
      if (!installed) console.log(`  ${run} install`);
      console.log(`  ${run} run launch        # builds + opens Extension Development Host`);
      console.log(`  # or \`${run} run dev\` + F5 inside VS Code for watch mode\n`);
    } catch (err: any) {
      console.error(`\n✗ Failed to scaffold: ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

function toTitle(s: string): string {
  return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function toBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  return undefined;
}

function which(cmd: string): boolean {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' });
  return r.status === 0;
}

function initGit(cwd: string): boolean {
  const r = spawnSync('git', ['init'], { cwd, stdio: 'inherit' });
  if (r.status === 0) {
    console.log('✓ Initialized git repository');
    return true;
  }
  console.warn('! Could not initialize git repository');
  return false;
}

function runInstall(pm: string, cwd: string): boolean {
  console.log(`\nInstalling dependencies with ${pm}...\n`);
  const r = spawnSync(pm, ['install'], { cwd, stdio: 'inherit' });
  if (r.status === 0) {
    console.log('\n✓ Dependencies installed');
    return true;
  }
  console.warn(`\n! ${pm} install failed — run it manually`);
  return false;
}

export default createCommand;
