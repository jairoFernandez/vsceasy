import { defineStore } from '../shared/vsceasy';

/**
 * Reactive store: a single observable value. Mutate it with `.set()` / `.update()`
 * and anything subscribed reacts.
 *
 *   import { {{name}} } from '../stores/{{name}}';
 *   {{name}}.set({{example}});
 *   {{name}}.update((v) => v);
 *
 * To push changes to a webview, watch it on the host and emit over RPC:
 *
 *   // inside a panel/subpanel rpc():
 *   import { watch } from '../shared/vsceasy';
 *   import { {{name}} } from '../stores/{{name}}';
 *   watch({{name}}, () => server.emit('{{name}}:changed', {{name}}.get()));
 *
 * Then listen in the webview:
 *
 *   import { listen } from '../shared/vsceasy/client';
 *   listen(api, '{{name}}:changed', (v) => render(v));
 */
export const {{name}} = defineStore<{{type}}>({{initial}});
