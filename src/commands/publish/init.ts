import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { publishInit } from '../../lib/publish/init';
import { findProjectRoot, findTemplatesRoot } from '../../lib/findProject';

const publishInitCommand: Command = {
  name: 'init',
  description: 'Prepare project for marketplace: README, CHANGELOG, icon placeholder, package.json fields, dry-run vsce ls',
  params: [
    { name: 'skipDryPack', description: 'Skip running `npx vsce ls`', required: false, type: ParamType.Boolean },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const templatesRoot = findTemplatesRoot();
      const result = publishInit({
        projectRoot,
        templatesRoot,
        runDryPack: !args.skipDryPack,
      });
      const rel = (p: string) => path.relative(projectRoot, p);
      console.log('\n✓ Publish preflight ready.\n');
      for (const f of result.created) console.log(`  + ${rel(f)}`);
      if (result.pkgUpdated) console.log('  ~ package.json fields populated');
      if (result.warnings.length) {
        console.log('\n  Warnings:');
        for (const w of result.warnings) console.log(`    • ${w}`);
      }
      console.log('\n  When ready: `npx @vscode/vsce package` → `npx @vscode/vsce publish`\n');
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

export default publishInitCommand;
