import { defineMenu } from '../shared/vsceasy';

export default defineMenu({
  title: '{{title}}',
  icon: '{{icon}}',
  items: [
    {
      label: 'Panels',
      children: [
        // { label: 'Dashboard', panel: 'dashboard' },
      ],
    },
    {
      label: 'Actions',
      children: [
        // { label: 'Hello', command: 'hello', icon: 'play' },
        // { label: 'Docs', url: 'https://example.com', icon: 'book' },
      ],
    },
  ],
});
