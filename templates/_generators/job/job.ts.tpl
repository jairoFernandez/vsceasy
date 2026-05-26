import { defineJob } from '../shared/vsceasy';

export default defineJob({
  title: '{{title}}',
  schedule: {{schedule}},{{minIntervalLine}}
  run: async (vscode, ctx) => {
    // TODO: implement {{name}} work
    console.log('[{{name}}] tick', new Date().toISOString());
  },
});
