import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { substitute } from '../scaffold';

export interface PublishInitOptions {
  projectRoot: string;
  templatesRoot: string;
  runDryPack?: boolean;
}

export interface PublishInitResult {
  created: string[];
  pkgUpdated: boolean;
  warnings: string[];
  dryPackOk: boolean | null;
}

export function publishInit(opts: PublishInitOptions): PublishInitResult {
  const created: string[] = [];
  const warnings: string[] = [];
  const pkgPath = path.join(opts.projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) throw new Error(`No package.json at ${opts.projectRoot}`);
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const vars = {
    displayName: pkg.displayName ?? pkg.name ?? 'My Extension',
    description: pkg.description ?? '',
  };

  // README.md
  const readme = path.join(opts.projectRoot, 'README.md');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      substitute(fs.readFileSync(path.join(opts.templatesRoot, '_generators', 'publish', 'README.md.tpl'), 'utf8'), vars),
    );
    created.push(readme);
  }

  // CHANGELOG.md
  const changelog = path.join(opts.projectRoot, 'CHANGELOG.md');
  if (!fs.existsSync(changelog)) {
    fs.writeFileSync(
      changelog,
      fs.readFileSync(path.join(opts.templatesRoot, '_generators', 'publish', 'CHANGELOG.md.tpl'), 'utf8'),
    );
    created.push(changelog);
  }

  // LICENSE
  const license = path.join(opts.projectRoot, 'LICENSE');
  if (!fs.existsSync(license)) {
    warnings.push('LICENSE not found — marketplace recommends an explicit license file.');
  }

  // icon placeholder
  const iconDir = path.join(opts.projectRoot, 'assets');
  const iconFile = path.join(iconDir, 'icon.png');
  if (!fs.existsSync(iconFile)) {
    fs.mkdirSync(iconDir, { recursive: true });
    fs.writeFileSync(iconFile + '.placeholder', 'Drop a 128×128 PNG named icon.png here.\n');
    warnings.push('No `assets/icon.png` yet — marketplace requires a 128×128 icon.');
  }

  // package.json fields
  let pkgUpdated = false;
  if (!pkg.publisher || pkg.publisher === 'your-publisher') {
    warnings.push('`publisher` in package.json is missing or placeholder. Set it before publishing.');
  }
  if (!pkg.repository) {
    pkg.repository = { type: 'git', url: '' };
    pkgUpdated = true;
    warnings.push('Added empty `repository.url` — fill it before publishing.');
  }
  if (!pkg.icon && fs.existsSync(iconFile)) {
    pkg.icon = 'assets/icon.png';
    pkgUpdated = true;
  }
  if (!pkg.categories) {
    pkg.categories = ['Other'];
    pkgUpdated = true;
  }
  if (pkgUpdated) fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  // vsce ls dry-run
  let dryPackOk: boolean | null = null;
  if (opts.runDryPack !== false) {
    const r = spawnSync('npx', ['--yes', '@vscode/vsce', 'ls'], { cwd: opts.projectRoot, stdio: 'inherit' });
    dryPackOk = r.status === 0;
    if (!dryPackOk) warnings.push('`vsce ls` exited non-zero — inspect output above.');
  }

  return { created, pkgUpdated, warnings, dryPackOk };
}
