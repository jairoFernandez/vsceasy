import { describe, test, expect } from "bun:test";

import { cli } from '../../cli';

describe("CLI", () => {
  test("Validate CLI default params", () => {
    expect(cli.getName()).toBe("@ideascol/vscode-extension-framework");
    expect(cli.getDescription()).toBe("Framework para crear VSCode extensions rapido con UI React/Svelte/Vue/Vanilla, RPC tipado webview-extension, y file-based routing de panels/commands");
    expect(cli.getCommands().length).toBe(1);
    expect(cli.getOptions()?.interactive).toBe(true);
    expect(cli.getOptions()?.version).toBe("1.0.0");
  });

  test("required params for first command", () => {
    const firstCommand = cli.getCommands()[0];

    expect(cli.getCommands().length).toBe(1);
    expect(firstCommand.params.length).toBe(1);
    expect(firstCommand.params[0].required).toBe(true);
  });
});
