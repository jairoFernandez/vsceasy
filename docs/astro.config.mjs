import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import mermaid from 'astro-mermaid';
import starlightLlmsTxt from 'starlight-llms-txt';

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
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/jairoFernandez/vsceasy',
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/jairoFernandez/vsceasy/edit/main/docs/',
      },
      // Let crawlers and coding agents discover the LLM-readable dumps from any page.
      head: [
        {
          tag: 'link',
          attrs: {
            rel: 'alternate',
            type: 'text/plain',
            href: 'https://vsceasy.dev/llms.txt',
            title: 'vsceasy documentation index for LLMs',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'alternate',
            type: 'text/plain',
            href: 'https://vsceasy.dev/llms-full.txt',
            title: 'Full vsceasy documentation as plain text',
          },
        },
      ],
      plugins: [
        starlightLlmsTxt({
          projectName: 'vsceasy',
          description:
            'CLI and framework to build VS Code extensions with a React webview UI, a typed RPC bridge between extension host and webview, file-based routing for panels, commands, menus, tree views and subpanels, and a mini-ORM for local persistence.',
          details: [
            'vsceasy scaffolds and grows a VS Code extension from the command line.',
            'Generated projects are TypeScript + React: the extension host runs Node, the UI runs in a webview, and the two talk over a generated, fully typed RPC bridge.',
            'Everything is file-based: adding a file under the right folder registers a panel, command, menu item, tree view or job — no manual package.json contributes editing.',
            'The mini-ORM persists models in workspace or global storage, with relations and reactive stores that push updates to the webview.',
          ].join('\n'),
          optionalLinks: [
            {
              label: 'npm package',
              url: 'https://www.npmjs.com/package/@vsceasy/cli',
              description: 'Install with `npm i -g @vsceasy/cli`',
            },
            {
              label: 'GitHub repository',
              url: 'https://github.com/jairoFernandez/vsceasy',
              description: 'Source, issues and changelog',
            },
          ],
          // Emit the source Markdown instead of rendering pages to HTML first:
          // keeps ```mermaid blocks as readable text and skips the React demos
          // embedded in the .mdx pages, which have no renderer in this route.
          rawContent: true,
          // The tutorial is long and repeats the guides; drop it from the
          // compact llms-small.txt only.
          exclude: ['tutorial/**'],
        }),
      ],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Introduction', slug: 'introduction' },
            { label: 'Quick start', slug: 'quick-start' },
            { label: 'Concepts', slug: 'concepts' },
            { label: 'Project layout', slug: 'project-layout' },
            { label: 'Glossary', slug: 'glossary' },
            { label: 'Showcase', slug: 'showcase' },
            { label: 'Roadmap', slug: 'roadmap' },
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
            { label: 'Sidebar views', slug: 'guides/sidebar-views' },
            { label: 'Editor surface', slug: 'guides/editor-surface' },
            { label: 'The LLM client', slug: 'guides/llm' },
            { label: 'Language extensions', slug: 'guides/language-extensions' },
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
            { label: 'ai-guide', slug: 'commands/ai-guide' },
            { label: 'upgrade', slug: 'commands/upgrade' },
          ],
        },
      ],
    }),
  ],
});
