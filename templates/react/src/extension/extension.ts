import { bootstrap } from '../shared/vsxf';
import { registry } from './_registry';

export const activate = bootstrap(registry);
export function deactivate() {}
