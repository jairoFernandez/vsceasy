import { Command, ParamType } from '@ideascol/cli-maker';
import { Greet } from '../lib';

let commandGreet: Command = {
  name: 'greet',
  description: 'Greet the user',
  params: [
    {
      name: 'name',
      description: 'The name of the user to greet',
      required: true,
      type: ParamType.Text
    }],
  action: (args) => {
    const name = args.name;
    Greet(name);
  }
}

export default commandGreet;
