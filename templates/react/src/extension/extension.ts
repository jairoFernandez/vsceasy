import { bootstrap } from '../shared/vsceasy';
import { registry } from './_registry';

export const activate = bootstrap(registry);
export function deactivate() {}
