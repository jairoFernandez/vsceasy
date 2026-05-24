import { Command, ParamType } from '@ideascol/cli-maker';
import { runDoctor, applyFixes, CheckResult } from '../lib/doctor';
import { findProjectRoot } from '../lib/findProject';

const ICONS = { ok: '✓', warn: '⚠', error: '✗' } as const;
const COLORS = {
  ok: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  dim: '\x1b[90m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
} as const;

const doctorCommand: Command = {
  name: 'doctor',
  description: 'Diagnose a vsxf project: scripts, RPC contracts, menu refs, codicons, contributes sync',
  params: [
    {
      name: 'fix',
      description: 'Apply safe auto-fixes (missing RPC stubs, orphan menu items, .gitignore entries)',
      required: false,
      type: ParamType.Boolean,
    },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const wantFix = args.fix === true || args.fix === 'true';
      let report = runDoctor({ projectRoot });

      console.log(`\n${COLORS.bold}vsxf doctor${COLORS.reset} — ${report.displayName} ${COLORS.dim}@ ${projectRoot}${COLORS.reset}\n`);
      for (const r of report.results) {
        printResult(r);
      }

      const fixable = report.results.filter((r) => r.fix).length;
      const { ok, warn, error } = report.counts;
      console.log(
        `\n  ${COLORS.ok}${ok} ok${COLORS.reset} · ${COLORS.warn}${warn} warning${warn === 1 ? '' : 's'}${COLORS.reset} · ${COLORS.error}${error} error${error === 1 ? '' : 's'}${COLORS.reset}`,
      );
      if (fixable > 0 && !wantFix) {
        console.log(`  ${COLORS.dim}Re-run with --fix=true to apply ${fixable} safe fix(es).${COLORS.reset}\n`);
      } else {
        console.log('');
      }

      if (wantFix && fixable > 0) {
        const applied = applyFixes(report);
        console.log(`${COLORS.bold}Fixes applied:${COLORS.reset}`);
        for (const a of applied) console.log(`  ${COLORS.ok}✓${COLORS.reset} ${a.message}`);
        console.log('');
        // Re-run for a fresh report after fixes
        report = runDoctor({ projectRoot });
        console.log(`${COLORS.bold}After fix:${COLORS.reset}`);
        const { ok: ok2, warn: warn2, error: error2 } = report.counts;
        console.log(
          `  ${COLORS.ok}${ok2} ok${COLORS.reset} · ${COLORS.warn}${warn2} warning(s)${COLORS.reset} · ${COLORS.error}${error2} error(s)${COLORS.reset}\n`,
        );
        if (error2 > 0) process.exitCode = 1;
      } else if (error > 0) {
        process.exitCode = 1;
      }
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

function printResult(r: CheckResult): void {
  const color = COLORS[r.level];
  const icon = ICONS[r.level];
  console.log(`  ${color}${icon}${COLORS.reset} ${r.message}`);
  if (r.details && r.details.length > 0) {
    for (const d of r.details) {
      console.log(`      ${COLORS.dim}${d}${COLORS.reset}`);
    }
  }
}

export default doctorCommand;
