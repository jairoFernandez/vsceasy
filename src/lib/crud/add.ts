import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { substitute } from '../scaffold';
import { assertNoOverwrite } from '../validate';
import { parseModelFile, inferInputSpec, ParsedField, InputKind } from './parseModel';
import { readCrudConfig, CrudConfig, CrudFieldOverride } from './crudConfig';
import { addMenu } from '../menu/add';
import { editMenu } from '../menu/edit';

export interface AddCrudOptions {
  /** Model file basename without extension (e.g. `User`). Matches `src/models/<X>.ts`. */
  model: string;
  projectRoot: string;
  templatesRoot: string;
  /** `'existing:<menuId>'`, `'new:<menuId>'`, or `'none'`. Default `'none'`. */
  menu?: string;
  runGen?: boolean;
}

export interface AddCrudResult {
  created: string[];
  modified: string[];
  menu?: { id: string; created: boolean };
  genRan: boolean;
}

export function addCrud(opts: AddCrudOptions): AddCrudResult {
  const modelFile = path.join(opts.projectRoot, 'src', 'models', `${opts.model}.ts`);
  const model = parseModelFile(modelFile);
  const cfg = readCrudConfig(opts.projectRoot, opts.model);

  // Resolve display order (config.order first, then remaining in source order)
  const hidden = new Set(cfg.hidden ?? []);
  const ordered = orderFields(model.fields, cfg.order ?? []);
  const visible = ordered.filter((f) => !hidden.has(f.name));
  if (visible.length === 0) {
    throw new Error(`CRUD for "${model.name}": no visible fields after applying \`hidden\` config.`);
  }

  const title = cfg.title ?? model.plural;
  const listId = `${camelLower(model.plural)}List`;            // e.g. `usersList`
  const formId = `${camelLower(model.name)}Form`;              // e.g. `userForm`
  const listApiName = `${model.plural}ListApi`;                // e.g. `UsersListApi`
  const formApiName = `${model.name}FormApi`;                  // e.g. `UserFormApi`

  // Paths
  const servicePath = path.join(opts.projectRoot, 'src', 'services', `${model.name}Service.ts`);
  const listPanelPath = path.join(opts.projectRoot, 'src', 'panels', `${listId}.ts`);
  const formPanelPath = path.join(opts.projectRoot, 'src', 'panels', `${formId}.ts`);
  const listWebDir = path.join(opts.projectRoot, 'src', 'webview', 'panels', listId);
  const formWebDir = path.join(opts.projectRoot, 'src', 'webview', 'panels', formId);
  const apiPath = path.join(opts.projectRoot, 'src', 'shared', 'api.ts');

  assertNoOverwrite(opts.projectRoot, servicePath, 'Service');
  assertNoOverwrite(opts.projectRoot, listPanelPath, 'List panel');
  assertNoOverwrite(opts.projectRoot, formPanelPath, 'Form panel');
  assertNoOverwrite(opts.projectRoot, listWebDir, 'List webview dir');
  assertNoOverwrite(opts.projectRoot, formWebDir, 'Form webview dir');

  // Prefix from package.json (used to wire executeCommand for openForm)
  const pkg = JSON.parse(fs.readFileSync(path.join(opts.projectRoot, 'package.json'), 'utf8'));
  const prefix: string =
    pkg.vsceasy?.commandPrefix ?? pkg.name?.replace(/^@[^/]+\//, '').replace(/[^a-zA-Z0-9]+/g, '') ?? 'ext';

  // Build template vars shared across all files
  const baseVars: Record<string, string> = {
    Name: model.name,
    name: camelLower(model.name),
    Plural: model.plural,
    plural: camelLower(model.plural),
    primaryKey: model.primaryKey,
    title,
    listId,
    formId,
    prefix,
  };

  const created: string[] = [];
  const modified: string[] = [];

  // 1. Service
  writeFromTpl(
    path.join(opts.templatesRoot, '_generators', 'crud', 'service.ts.tpl'),
    servicePath,
    baseVars,
    created,
  );

  // 1b. Form navigation hand-off (list → form edit id)
  writeFromTpl(
    path.join(opts.templatesRoot, '_generators', 'crud', 'formNav.ts.tpl'),
    path.join(opts.projectRoot, 'src', 'services', `${camelLower(model.name)}FormNav.ts`),
    baseVars,
    created,
  );

  // 2. List panel
  writeFromTpl(
    path.join(opts.templatesRoot, '_generators', 'crud', 'listPanel.ts.tpl'),
    listPanelPath,
    baseVars,
    created,
  );

  // 3. Form panel
  writeFromTpl(
    path.join(opts.templatesRoot, '_generators', 'crud', 'formPanel.ts.tpl'),
    formPanelPath,
    baseVars,
    created,
  );

  // 4. List webview bundle (App.tsx + main.tsx)
  fs.mkdirSync(listWebDir, { recursive: true });
  const listVars = {
    ...baseVars,
    listHeaderCells: visible
      .map((f) => `              <th style={{ padding: '6px 8px' }}>${escapeJsx(label(f, cfg))}</th>`)
      .join('\n'),
    listBodyCells: visible
      .map((f) => `                <td style={{ padding: '6px 8px' }}>{String(r.${f.name} ?? '')}</td>`)
      .join('\n'),
    listColCount: String(visible.length + 1),
  };
  writeFromTpl(
    path.join(opts.templatesRoot, '_generators', 'crud', 'listApp.tsx.tpl'),
    path.join(listWebDir, 'App.tsx'),
    listVars,
    created,
  );
  writeFromTpl(
    path.join(opts.templatesRoot, '_generators', 'crud', 'main.tsx.tpl'),
    path.join(listWebDir, 'main.tsx'),
    baseVars,
    created,
  );

  // 5. Form webview bundle
  fs.mkdirSync(formWebDir, { recursive: true });
  const formInputs = visible
    .filter((f) => !(cfg.fields?.[f.name]?.hideInForm))
    .map((f) => renderInput(f, cfg.fields?.[f.name]))
    .join('\n');
  const emptyLit = buildEmptyFormLiteral(visible, cfg);
  writeFromTpl(
    path.join(opts.templatesRoot, '_generators', 'crud', 'formApp.tsx.tpl'),
    path.join(formWebDir, 'App.tsx'),
    { ...baseVars, formFieldInputs: formInputs, emptyFormLiteral: emptyLit },
    created,
  );
  writeFromTpl(
    path.join(opts.templatesRoot, '_generators', 'crud', 'main.tsx.tpl'),
    path.join(formWebDir, 'main.tsx'),
    baseVars,
    created,
  );

  // 6. Append APIs to src/shared/api.ts
  appendApi(apiPath, listApiName, model, created, modified);
  appendApiForm(apiPath, formApiName, model, created, modified);

  // 7. Menu wiring
  let menuInfo: AddCrudResult['menu'];
  if (opts.menu && opts.menu !== 'none') {
    menuInfo = wireMenu(opts, model, cfg, listId, formId);
  }

  // 8. Run gen
  let genRan = false;
  if (opts.runGen !== false) genRan = runGen(opts.projectRoot);

  return { created, modified, menu: menuInfo, genRan };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function writeFromTpl(tpl: string, target: string, vars: Record<string, string>, created: string[]) {
  if (!fs.existsSync(tpl)) throw new Error(`CRUD template missing: ${tpl}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, substitute(fs.readFileSync(tpl, 'utf8'), vars));
  created.push(target);
}

function orderFields(fields: ParsedField[], order: string[]): ParsedField[] {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const out: ParsedField[] = [];
  for (const name of order) {
    const f = byName.get(name);
    if (f) { out.push(f); byName.delete(name); }
  }
  for (const f of byName.values()) out.push(f);
  return out;
}

function label(field: ParsedField, cfg: CrudConfig): string {
  const override = cfg.fields?.[field.name]?.label;
  if (override) return override;
  return field.name.charAt(0).toUpperCase() + field.name.slice(1).replace(/([A-Z])/g, ' $1');
}

function escapeJsx(s: string): string {
  return s.replace(/'/g, '&apos;').replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return s.replace(/'/g, "\\'");
}

function renderInput(field: ParsedField, override?: CrudFieldOverride): string {
  const spec = override?.input
    ? { kind: override.input, options: override.options }
    : inferInputSpec(field.type);
  const labelText = override?.label
    ?? field.name.charAt(0).toUpperCase() + field.name.slice(1).replace(/([A-Z])/g, ' $1');
  const placeholder = override?.placeholder ?? '';
  const placeholderAttr = placeholder ? ` placeholder='${escapeAttr(placeholder)}'` : '';
  const required = field.optional ? '' : ' required';
  const name = field.name;

  const wrap = (input: string) =>
    `      <label style={{ display: 'grid', gap: 4 }}>\n` +
    `        <span style={{ opacity: 0.8 }}>${labelText}</span>\n` +
    `${input}\n` +
    `      </label>`;

  switch (spec.kind as InputKind) {
    case 'number':
      return wrap(
        `        <input type="number"${placeholderAttr}${required} value={form.${name} as any ?? ''} onChange={(e) => onChange('${name}', e.target.value === '' ? undefined : Number(e.target.value))} />`,
      );
    case 'boolean':
      return wrap(
        `        <input type="checkbox" checked={!!form.${name}} onChange={(e) => onChange('${name}', e.target.checked as any)} />`,
      );
    case 'date':
      return wrap(
        `        <input type="date"${required} value={(form.${name} as any) ?? ''} onChange={(e) => onChange('${name}', e.target.value as any)} />`,
      );
    case 'select': {
      const opts = (spec.options ?? [])
        .map((o) => `          <option value=${JSON.stringify(o)}>${escapeJsx(o)}</option>`)
        .join('\n');
      return wrap(
        `        <select${required} value={(form.${name} as any) ?? ''} onChange={(e) => onChange('${name}', e.target.value as any)}>\n` +
        `          <option value=""></option>\n` +
        `${opts}\n` +
        `        </select>`,
      );
    }
    case 'textarea':
      return wrap(
        `        <textarea${placeholderAttr}${required} rows={4} value={(form.${name} as any) ?? ''} onChange={(e) => onChange('${name}', e.target.value as any)} />`,
      );
    case 'text':
    default:
      return wrap(
        `        <input type="text"${placeholderAttr}${required} value={(form.${name} as any) ?? ''} onChange={(e) => onChange('${name}', e.target.value as any)} />`,
      );
  }
}

function buildEmptyFormLiteral(fields: ParsedField[], cfg: CrudConfig): string {
  const lines: string[] = ['{'];
  for (const f of fields) {
    if (cfg.fields?.[f.name]?.hideInForm) continue;
    const spec = cfg.fields?.[f.name]?.input
      ? { kind: cfg.fields[f.name]!.input as InputKind }
      : inferInputSpec(f.type);
    let val = "''";
    if (spec.kind === 'number') val = '0';
    else if (spec.kind === 'boolean') val = 'false';
    lines.push(`  ${f.name}: ${val} as any,`);
  }
  lines.push('}');
  return lines.join('\n');
}

function appendApi(
  apiPath: string,
  apiName: string,
  model: { name: string; primaryKey: string },
  created: string[],
  modified: string[],
) {
  const sig =
    `\nexport interface ${apiName} {\n` +
    `  list(): Promise<${model.name}[]>;\n` +
    `  delete(id: ${model.name}['${model.primaryKey}']): Promise<boolean>;\n` +
    `  openForm(id?: ${model.name}['${model.primaryKey}']): Promise<void>;\n` +
    `}\n`;
  ensureImport(apiPath, model.name);
  appendIfMissing(apiPath, apiName, sig, created, modified);
}

function appendApiForm(
  apiPath: string,
  apiName: string,
  model: { name: string; primaryKey: string },
  created: string[],
  modified: string[],
) {
  const sig =
    `\nexport interface ${apiName} {\n` +
    `  pendingId(): Promise<${model.name}['${model.primaryKey}'] | null>;\n` +
    `  get(id: ${model.name}['${model.primaryKey}'] | null): Promise<${model.name} | null>;\n` +
    `  save(row: ${model.name}): Promise<${model.name}>;\n` +
    `  cancel(): Promise<void>;\n` +
    `}\n`;
  ensureImport(apiPath, model.name);
  appendIfMissing(apiPath, apiName, sig, created, modified);
}

function ensureImport(apiPath: string, modelName: string) {
  if (!fs.existsSync(apiPath)) {
    fs.mkdirSync(path.dirname(apiPath), { recursive: true });
    fs.writeFileSync(apiPath, `import type { ${modelName} } from '../models/${modelName}';\n`);
    return;
  }
  let src = fs.readFileSync(apiPath, 'utf8');
  if (new RegExp(`from\\s+['"]\\.\\./models/${modelName}['"]`).test(src)) return;
  src = `import type { ${modelName} } from '../models/${modelName}';\n` + src;
  fs.writeFileSync(apiPath, src);
}

function appendIfMissing(
  apiPath: string,
  apiName: string,
  block: string,
  created: string[],
  modified: string[],
) {
  if (!fs.existsSync(apiPath)) {
    fs.writeFileSync(apiPath, block.trimStart());
    created.push(apiPath);
    return;
  }
  const src = fs.readFileSync(apiPath, 'utf8');
  if (new RegExp(`\\bexport\\s+interface\\s+${apiName}\\b`).test(src)) return;
  const sep = src.endsWith('\n') ? '' : '\n';
  fs.writeFileSync(apiPath, src + sep + block);
  if (!modified.includes(apiPath)) modified.push(apiPath);
}

function wireMenu(
  opts: AddCrudOptions,
  model: ReturnType<typeof parseModelFile>,
  cfg: CrudConfig,
  listId: string,
  formId: string,
): { id: string; created: boolean } {
  const spec = opts.menu!;
  const [kind, value] = spec.split(':');
  let menuId: string;
  let created = false;
  if (kind === 'new') {
    menuId = value || camelLower(model.plural);
    addMenu({
      name: menuId,
      title: cfg.title ?? model.plural,
      icon: cfg.icon,
      projectRoot: opts.projectRoot,
      templatesRoot: opts.templatesRoot,
      runGen: false,
    });
    created = true;
  } else if (kind === 'existing') {
    if (!value) throw new Error('--menu existing requires `:<menuId>` (e.g. existing:settings).');
    menuId = value;
  } else {
    throw new Error(`Invalid --menu "${spec}". Use: none | existing:<id> | new:<id>`);
  }

  editMenu({
    projectRoot: opts.projectRoot,
    menuName: menuId,
    runGen: false,
    item: { label: cfg.title ?? model.plural, kind: 'panel', target: listId, icon: cfg.icon ?? 'list-unordered' },
  });
  editMenu({
    projectRoot: opts.projectRoot,
    menuName: menuId,
    runGen: false,
    item: { label: `New ${model.name}`, kind: 'panel', target: formId, icon: 'add' },
  });
  return { id: menuId, created };
}

function camelLower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function runGen(cwd: string): boolean {
  const tryRun = (cmd: string, args: string[]) => spawnSync(cmd, args, { cwd, stdio: 'inherit' }).status === 0;
  if (which('bun') && tryRun('bun', ['run', 'gen'])) return true;
  if (which('npm') && tryRun('npm', ['run', 'gen'])) return true;
  console.warn('\n! Could not run "gen" automatically. Run `bun run gen` manually.\n');
  return false;
}

function which(cmd: string): boolean {
  return spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' }).status === 0;
}
