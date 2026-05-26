import * as fs from 'fs';
import * as path from 'path';

export interface TestSetupOptions {
  projectRoot: string;
  templatesRoot: string;
  force?: boolean;
}

export interface TestSetupResult {
  created: string[];
  pkgUpdated: boolean;
}

export function setupTests(opts: TestSetupOptions): TestSetupResult {
  const created: string[] = [];

  const vitestCfg = path.join(opts.projectRoot, 'vitest.config.ts');
  if (!fs.existsSync(vitestCfg) || opts.force) {
    fs.writeFileSync(
      vitestCfg,
      fs.readFileSync(path.join(opts.templatesRoot, '_generators', 'test', 'vitest.config.ts.tpl'), 'utf8'),
    );
    created.push(vitestCfg);
  }

  const sampleDir = path.join(opts.projectRoot, 'src', '__tests__');
  fs.mkdirSync(sampleDir, { recursive: true });
  const sample = path.join(sampleDir, 'sample.test.ts');
  if (!fs.existsSync(sample) || opts.force) {
    fs.writeFileSync(
      sample,
      fs.readFileSync(path.join(opts.templatesRoot, '_generators', 'test', 'sample.test.ts.tpl'), 'utf8'),
    );
    created.push(sample);
  }
  const helpers = path.join(sampleDir, '_helpers.ts');
  if (!fs.existsSync(helpers) || opts.force) {
    fs.writeFileSync(
      helpers,
      fs.readFileSync(path.join(opts.templatesRoot, '_generators', 'test', '_helpers.ts.tpl'), 'utf8'),
    );
    created.push(helpers);
  }

  const mocksDir = path.join(sampleDir, '__mocks__');
  fs.mkdirSync(mocksDir, { recursive: true });
  const vscodeStub = path.join(mocksDir, 'vscode.ts');
  if (!fs.existsSync(vscodeStub) || opts.force) {
    fs.writeFileSync(
      vscodeStub,
      fs.readFileSync(path.join(opts.templatesRoot, '_generators', 'test', 'vscode.stub.ts.tpl'), 'utf8'),
    );
    created.push(vscodeStub);
  }

  const pkgPath = path.join(opts.projectRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.scripts ??= {};
  let pkgUpdated = false;
  if (!pkg.scripts.test || pkg.scripts.test === 'echo "Error: no test specified" && exit 1') {
    pkg.scripts.test = 'vitest run';
    pkgUpdated = true;
  }
  if (!pkg.scripts['test:watch']) {
    pkg.scripts['test:watch'] = 'vitest';
    pkgUpdated = true;
  }
  pkg.devDependencies ??= {};
  if (!pkg.devDependencies.vitest) {
    pkg.devDependencies.vitest = '^2.0.0';
    pkgUpdated = true;
  }
  if (pkgUpdated) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  return { created, pkgUpdated };
}
