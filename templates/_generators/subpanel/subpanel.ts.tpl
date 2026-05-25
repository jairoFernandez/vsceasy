import { defineSubpanel } from '../shared/vsxf';
{{apiImport}}
export default defineSubpanel{{apiGeneric}}({
  title: '{{title}}',
  menu: '{{menu}}',{{rpcBlock}}
});
