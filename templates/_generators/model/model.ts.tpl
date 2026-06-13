import { defineEntity, db } from '../helpers/db';

export interface {{Name}} {
{{fieldLines}}
}

export const {{Plural}} = defineEntity<{{Name}}>('{{collection}}', {
  primaryKey: '{{primaryKey}}',{{indexesLine}}
});

/**
 * Typed repo accessor. Lazy — assumes `initDb(context)` ran on activate.
 *
 *   import { {{Plural}}Repo } from '../models/{{Name}}';
 *   await {{Plural}}Repo().insert({ ... });
 */
export const {{Plural}}Repo = () => db()({{Plural}});{{relationsBlock}}
