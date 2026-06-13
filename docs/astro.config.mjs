import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import mermaid from 'astro-mermaid';

export default defineConfig({
  // Set `site` to the deployed URL when publishing (enables canonical + sitemap).
  site: 'https://vsceasy.dev',
  integrations: [
    // Must run before Starlight so it transforms ```mermaid blocks first.
    mermaid({
      theme: 'default',
      autoTheme: true, // follow Starlight light/dark
    }),
    react(),
    starlight({
      title: 'vsceasy',
      description:
        'Build VS Code extensions fast — React UI, typed RPC, file-based routing, and a mini-ORM, all scaffolded from the CLI.',
      logo: {
        src: './src/assets/logo-mark.svg',
        alt: 'vsceasy octopus mascot',
      },
      favicon: '/favicon.svg',
      social: {
        github: 'https://github.com/jairoFernandez/vsceasy',
      },
      editLink: {
        baseUrl: 'https://github.com/jairoFernandez/vsceasy/edit/main/docs/',
      },
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Introduction', slug: 'introduction' },
            { label: 'Quick start', slug: 'quick-start' },
            { label: 'Concepts', slug: 'concepts' },
            { label: 'Project layout', slug: 'project-layout' },
            { label: 'Glossary', slug: 'glossary' },
          ],
        },
        {
          label: 'Tutorial: Todo extension',
          items: [
            { label: 'Overview', slug: 'tutorial' },
            { label: '1. Scaffold', slug: 'tutorial/01-scaffold' },
            { label: '2. Model', slug: 'tutorial/02-model' },
            { label: '3. CRUD UI', slug: 'tutorial/03-crud' },
            { label: '4. Job & run', slug: 'tutorial/04-job-and-run' },
            { label: '5. Menus', slug: 'tutorial/05-menus' },
            { label: '6. Status bar', slug: 'tutorial/06-statusbar' },
            { label: '7. Sidebar views', slug: 'tutorial/07-sidebar-views' },
            { label: '8. Reactivity', slug: 'tutorial/08-reactivity' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'The wizard', slug: 'guides/wizard' },
            { label: 'Typed RPC', slug: 'guides/rpc' },
            { label: 'Webview components', slug: 'guides/components' },
            { label: 'CRUD scaffolding', slug: 'guides/crud' },
            { label: 'The mini-ORM', slug: 'guides/orm' },
            { label: 'Relations', slug: 'guides/relations' },
            { label: 'Reactivity', slug: 'guides/reactivity' },
            { label: 'Publishing', slug: 'guides/publishing' },
          ],
        },
        {
          label: 'Commands',
          items: [
            { label: 'Overview', slug: 'commands' },
            { label: 'create', slug: 'commands/create' },
            { label: 'wizard', slug: 'commands/wizard' },
            { label: 'panel add', slug: 'commands/panel-add' },
            { label: 'command add', slug: 'commands/command-add' },
            { label: 'menu add / edit', slug: 'commands/menu' },
            { label: 'rpc add', slug: 'commands/rpc-add' },
            { label: 'statusBar add', slug: 'commands/statusbar-add' },
            { label: 'subpanel add', slug: 'commands/subpanel-add' },
            { label: 'treeview add', slug: 'commands/treeview-add' },
            { label: 'components add', slug: 'commands/components-add' },
            { label: 'db init', slug: 'commands/db-init' },
            { label: 'model add', slug: 'commands/model-add' },
            { label: 'store add', slug: 'commands/store-add' },
            { label: 'crud add', slug: 'commands/crud-add' },
            { label: 'job add', slug: 'commands/job-add' },
            { label: 'helper add', slug: 'commands/helper-add' },
            { label: 'test setup', slug: 'commands/test-setup' },
            { label: 'publish init', slug: 'commands/publish-init' },
            { label: 'doctor', slug: 'commands/doctor' },
            { label: 'upgrade', slug: 'commands/upgrade' },
          ],
        },
      ],
    }),
  ],
});
