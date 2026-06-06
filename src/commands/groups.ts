import { Command } from '@ideascol/cli-maker';
import AddPanel from './panel/add';
import AddMenu from './menu/add';
import EditMenu from './menu/edit';
import AddCommand from './command/add';
import AddRpcMethod from './rpc/add';
import AddStatusBar from './statusBar/add';
import AddSubpanel from './subpanel/add';
import AddTreeView from './treeView/add';
import TestSetup from './test/setup';
import PublishInit from './publish/init';
import AddHelper from './helper/add';
import AddJob from './job/add';
import DbInit from './db/init';
import AddModel from './model/add';
import AddCrud from './crud/add';

function group(name: string, description: string, subcommands: Command[]): Command {
  return {
    name,
    description,
    params: [],
    subcommands,
    action: () => {
      console.log(`\nUse one of: ${subcommands.map((s) => s.name).join(', ')}\n`);
      console.log(`Run \`vsceasy ${name} <subcommand> --help\` for details.\n`);
    },
  };
}

export const PanelGroup = group('panel', 'Manage panels (webview + RPC bridge)', [AddPanel]);
export const MenuGroup = group('menu', 'Manage sidebar menus (activity bar tree views)', [AddMenu, EditMenu]);
export const CommandGroup = group('command', 'Manage palette commands', [AddCommand]);
export const RpcGroup = group('rpc', 'Manage typed RPC methods on panels', [AddRpcMethod]);
export const StatusBarGroup = group('statusBar', 'Manage status bar items', [AddStatusBar]);
export const SubpanelGroup = group('subpanel', 'Manage inline sidebar webview sections (subpanels)', [AddSubpanel]);
export const TreeViewGroup = group('treeview', 'Manage data-driven tree views (getChildren/getTreeItem)', [AddTreeView]);
export const TestGroup = group('test', 'Test scaffolding (Vitest)', [TestSetup]);
export const PublishGroup = group('publish', 'Marketplace publish helpers', [PublishInit]);
export const HelperGroup = group('helper', 'Generate runtime helpers (secrets, config, state, notifications)', [AddHelper]);
export const JobGroup = group('job', 'Manage recurring / event-triggered jobs (interval, dailyAt, on, onFile)', [AddJob]);
export const DbGroup = group('db', 'Initialize the project database (mini-ORM)', [DbInit]);
export const ModelGroup = group('model', 'Manage typed models (entities + repos) under src/models/', [AddModel]);
export const CrudGroup = group('crud', 'Scaffold full CRUD UI (service + list panel + form panel + RPC) for a model', [AddCrud]);
