import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scaffold } from '../../lib/scaffold';

/**
 * Coverage for the editor-surface primitives — completions, inline completions,
 * typing guards, decorations and terminals. These have no generator yet, so the
 * contract under test is: a file dropped in the convention directory ends up in
 * the generated registry, and the runtime exports the matching define* helper.
 */
describe('editor primitives', () => {
  const templatesRoot = path.resolve(__dirname, '../../../templates');

  async function scaffoldProject(): Promise<string> {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vsceasy-editorprim-'));
    const target = path.join(tmp, 'demo');
    await scaffold({
      name: 'demo',
      displayName: 'Demo',
      description: 'demo',
      publisher: 'acme',
      ui: 'react',
      targetDir: target,
      templatesRoot,
    });
    return target;
  }

  /** Run the project's own gen.ts the way `bun run gen` does. */
  function runGen(project: string) {
    const proc = Bun.spawnSync(['bun', 'scripts/gen.ts'], { cwd: project });
    if (proc.exitCode !== 0) {
      throw new Error(`gen failed: ${proc.stderr.toString()}`);
    }
    return proc.stdout.toString();
  }

  const KINDS = [
    ['completions', 'defineCompletion', 'completions'],
    ['inlineCompletions', 'defineInlineCompletion', 'inlineCompletions'],
    ['typingGuards', 'defineTypingGuard', 'typingGuards'],
    ['hovers', 'defineHover', 'hovers'],
    ['decorations', 'defineDecoration', 'decorations'],
    ['terminals', 'defineTerminal', 'terminals'],
  ] as const;

  test('runtime exports every new define helper', () => {
    const index = fs.readFileSync(
      path.join(templatesRoot, 'react/src/shared/vsceasy/index.ts'),
      'utf8',
    );
    for (const [, helper] of KINDS) {
      expect(index).toContain(helper);
    }
    expect(index).toContain('refreshDecoration');
    expect(index).toContain('useTerminal');
    expect(index).toContain('createLlm');
  });

  test('gen discovers each convention dir and writes it to the registry', async () => {
    const project = await scaffoldProject();

    for (const [dir, helper] of KINDS) {
      const target = path.join(project, 'src', dir);
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(
        path.join(target, 'sample.ts'),
        `import { ${helper} } from '../shared/vsceasy';\nexport default ${helper}({} as never);\n`,
      );
    }

    runGen(project);
    const registry = fs.readFileSync(path.join(project, 'src/extension/_registry.ts'), 'utf8');

    for (const [, , registryKey] of KINDS) {
      expect(registry).toContain(`${registryKey}: {`);
      expect(registry).toMatch(new RegExp(`${registryKey}: \\{\\s*"sample":`));
    }
  });

  test('registry keeps empty objects for kinds with no files', async () => {
    const project = await scaffoldProject();
    runGen(project);
    const registry = fs.readFileSync(path.join(project, 'src/extension/_registry.ts'), 'utf8');
    // bootstrap iterates these optionally, but the shape must stay stable.
    for (const [, , registryKey] of KINDS) {
      expect(registry).toContain(`${registryKey}: {`);
    }
  });

  test('files prefixed with _ are ignored, as for every other kind', async () => {
    const project = await scaffoldProject();
    const dir = path.join(project, 'src/decorations');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '_helper.ts'), 'export default {};\n');
    fs.writeFileSync(path.join(dir, 'real.ts'), 'export default {};\n');

    runGen(project);
    const registry = fs.readFileSync(path.join(project, 'src/extension/_registry.ts'), 'utf8');
    expect(registry).toContain('"real"');
    expect(registry).not.toContain('_helper');
  });

  test('gen adds onStartupFinished for eagerly-registered kinds', async () => {
    const project = await scaffoldProject();
    const pkgPath = path.join(project, 'package.json');

    // A bare project activates lazily off its contributed commands.
    runGen(project);
    expect(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).activationEvents).toEqual([]);

    // A typing guard has no command to activate on, so it needs startup.
    const dir = path.join(project, 'src/typingGuards');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'guard.ts'), 'export default {};\n');
    runGen(project);
    expect(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).activationEvents).toEqual(['onStartupFinished']);

    // Running again must not duplicate it.
    runGen(project);
    expect(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).activationEvents).toEqual(['onStartupFinished']);

    // Removing the last eager kind takes it back out.
    fs.rmSync(dir, { recursive: true });
    runGen(project);
    expect(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).activationEvents).toEqual([]);
  });

  test('gen preserves activation events it does not own', async () => {
    const project = await scaffoldProject();
    const pkgPath = path.join(project, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.activationEvents = ['onLanguage:python'];
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

    fs.mkdirSync(path.join(project, 'src/terminals'), { recursive: true });
    fs.writeFileSync(path.join(project, 'src/terminals/t.ts'), 'export default {};\n');
    runGen(project);

    expect(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).activationEvents).toEqual([
      'onLanguage:python',
      'onStartupFinished',
    ]);
  });

  test('the type override is serialized, not fired concurrently', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../../packages/vsceasy-runtime/src/bootstrap.ts'),
      'utf8',
    );
    // VS Code re-enters `type` without awaiting the previous call, so guards
    // that await must be chained or fast typing silently drops characters.
    expect(src).toContain('let queue: Promise<unknown>');
    expect(src).toMatch(/registerCommand\('type',\s*\(args[^)]*\)\s*=>\s*\n?\s*serialize\(/);
  });

  test('deletion commands are intercepted, not just `type`', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../../packages/vsceasy-runtime/src/bootstrap.ts'),
      'utf8',
    );
    // Deletions are routed as their own commands; a guard that only overrides
    // `type` silently lets the user delete anything.
    for (const cmd of ['deleteLeft', 'deleteRight', 'deleteWordLeft', 'deleteWordRight']) {
      expect(src).toContain(`command: '${cmd}'`);
    }
    expect(src).toContain('clipboardCutAction');
    // Typing and deleting must share one queue or a fast backspace desyncs.
    expect(src.indexOf('let queue: Promise<unknown>')).toBeLessThan(src.indexOf("registerCommand('type'"));
  });

  test('onDelete is part of the typing guard contract', () => {
    const def = fs.readFileSync(
      path.resolve(__dirname, '../../../packages/vsceasy-runtime/src/define.ts'),
      'utf8',
    );
    expect(def).toContain('onDelete?:');
    expect(def).toContain('interface DeleteEvent');
  });

  test('the visible terminal does not inherit exec-only env', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../../packages/vsceasy-runtime/src/bootstrap.ts'),
      'utf8',
    );
    // `env` carries NO_COLOR for parseable captured output; applying it to the
    // visible terminal would strip the colour the user reads failures by.
    expect(src).toContain('env: def.terminalEnv');
    expect(src).not.toContain('env: def.env,');
  });

  test('decoration spans are clamped to the document', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../../packages/vsceasy-runtime/src/bootstrap.ts'),
      'utf8',
    );
    // An out-of-range span would be silently relocated by VS Code.
    expect(src).toContain('Math.min(s.line, editor.document.lineCount - 1)');
  });

  test('gen summary reports the new kinds', async () => {
    const project = await scaffoldProject();
    const dir = path.join(project, 'src/terminals');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'runner.ts'), 'export default {};\n');
    expect(runGen(project)).toContain('1 terminals');
  });
});
