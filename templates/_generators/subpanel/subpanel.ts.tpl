import { defineSubpanel } from '../shared/vsceasy';
{{apiImport}}
export default defineSubpanel{{apiGeneric}}({
  title: '{{title}}',
  menu: '{{menu}}',{{rpcBlock}}
});
