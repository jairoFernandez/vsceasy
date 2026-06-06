import { {{Plural}}Repo } from '../models/{{Name}}';
import type { {{Name}} } from '../models/{{Name}}';

/**
 * {{Name}} service — business logic between RPC handlers and the repo.
 * Put validation, derivations (e.g. timestamps), and cross-entity work here.
 */
export const {{Name}}Service = {
  async list(): Promise<{{Name}}[]> {
    return {{Plural}}Repo().findMany({ orderBy: '{{primaryKey}}:desc' });
  },

  async get(id: {{Name}}['{{primaryKey}}']): Promise<{{Name}} | null> {
    return {{Plural}}Repo().findById(id);
  },

  async save(row: {{Name}}): Promise<{{Name}}> {
    if (!row.{{primaryKey}}) {
      throw new Error('{{Name}}: {{primaryKey}} is required');
    }
    return {{Plural}}Repo().upsert(row);
  },

  async delete(id: {{Name}}['{{primaryKey}}']): Promise<boolean> {
    return {{Plural}}Repo().delete(id);
  },
};
