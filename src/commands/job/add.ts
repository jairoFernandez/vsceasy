import { Command, ParamType } from '@ideascol/cli-maker';
import * as path from 'path';
import { addJob, JobTrigger } from '../../lib/job/add';
import { findProjectRoot, findTemplatesRoot } from '../../lib/findProject';

const JOB_HELP = [
  '',
  'Schedule shapes (pick exactly one):',
  '  --every "30s"        — interval: ms number or "30s" | "5m" | "2h" | "1d"',
  '  --dailyAt "09:00"    — once per day at local HH:MM',
  '  --on startup         — | saveDocument | openDocument | changeActiveEditor | changeConfig',
  '  --onFile "**/*.md"   — filesystem watcher (create | change | delete)',
  '',
  '--minIntervalMs throttles re-runs across triggers (persisted in globalState).',
].join('\n');

const ON_EVENTS = ['startup', 'saveDocument', 'openDocument', 'changeActiveEditor', 'changeConfig'];

const addJobCommand: Command = {
  name: 'add',
  description: 'Add a recurring or event-triggered job (interval, daily, on event, on file change).' + JOB_HELP,
  params: [
    { name: 'name', description: 'Job id (camelCase, e.g. sync)', required: true, type: ParamType.Text },
    { name: 'title', description: 'Display label (default: PascalCase of name)', required: false, type: ParamType.Text },
    { name: 'every', description: 'Interval (e.g. 30s, 5m, 2h, 1d)', required: false, type: ParamType.Text },
    { name: 'dailyAt', description: 'Local HH:MM (e.g. 09:00)', required: false, type: ParamType.Text },
    {
      name: 'on',
      description: 'VS Code event trigger',
      required: false,
      type: ParamType.List,
      options: ON_EVENTS as unknown as any[],
    },
    { name: 'onFile', description: 'Filesystem glob (e.g. **/*.md)', required: false, type: ParamType.Text },
    { name: 'minIntervalMs', description: 'Throttle re-runs (ms)', required: false, type: ParamType.Number },
  ],
  action: async (args) => {
    try {
      const projectRoot = findProjectRoot();
      const templatesRoot = findTemplatesRoot();

      const trigger = resolveTrigger(args);

      const result = addJob({
        name: String(args.name).trim(),
        title: args.title ? String(args.title).trim() : undefined,
        trigger,
        minIntervalMs: args.minIntervalMs ? Number(args.minIntervalMs) : undefined,
        projectRoot,
        templatesRoot,
      });

      const rel = (p: string) => path.relative(projectRoot, p);
      console.log(`\n✓ Job "${args.name}" added.\n`);
      for (const f of result.created) console.log(`  + ${rel(f)}`);
      console.log(
        result.genRan
          ? '\n  Registry + package.json updated. Reload extension to start the job.\n'
          : '\n  Run `bun run gen` to register, then reload extension.\n',
      );
    } catch (err: any) {
      console.error(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
    }
  },
};

function resolveTrigger(args: any): JobTrigger {
  const picked: string[] = [];
  if (args.every) picked.push('every');
  if (args.dailyAt) picked.push('dailyAt');
  if (args.on) picked.push('on');
  if (args.onFile) picked.push('onFile');
  if (picked.length === 0) {
    throw new Error('Job requires a schedule: pass one of --every, --dailyAt, --on, --onFile.');
  }
  if (picked.length > 1) {
    throw new Error(`Job schedule: pass exactly one trigger, got: ${picked.join(', ')}.`);
  }
  if (args.every) return { every: String(args.every).trim() };
  if (args.dailyAt) return { dailyAt: String(args.dailyAt).trim() };
  if (args.on) return { on: String(args.on).trim() as any };
  return { onFile: String(args.onFile).trim() };
}

export default addJobCommand;
