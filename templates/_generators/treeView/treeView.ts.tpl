import { defineTreeView, TreeNode } from '../shared/vsceasy';

export default defineTreeView({
  title: '{{title}}',
  menu: '{{menu}}',
  getChildren: async (parent, vscode, ctx) => {
    if (!parent) {
      return [
        { label: 'Item 1', icon: 'file', tooltip: 'Replace with real data' },
        { label: 'Group', icon: 'folder', collapsed: 'collapsed', children: [] },
      ] as TreeNode[];
    }
    // Lazy children — return based on parent.id / parent.contextValue.
    return [];
  },
});
