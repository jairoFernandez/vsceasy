import { describe, it, expect } from 'vitest';
import { mockVscode, mockContext, mockRpcPair } from './_helpers';

describe('vscode mock', () => {
  it('captures notification calls', () => {
    const vscode = mockVscode();
    vscode.window.showInformationMessage('hello');
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('hello');
  });

  it('persists state via mock context', async () => {
    const ctx = mockContext();
    await ctx.workspaceState.update('key', 42);
    expect(ctx.workspaceState.get('key')).toBe(42);
  });
});

describe('RPC pair', () => {
  it('round-trips a typed handler call', async () => {
    const handlers = {
      async greet(name: string) {
        return `hi ${name}`;
      },
    };
    const api = mockRpcPair<typeof handlers>(handlers);
    expect(await api.greet('Jairo')).toBe('hi Jairo');
  });

  it('propagates handler errors', async () => {
    const handlers = {
      async boom() {
        throw new Error('nope');
      },
    };
    const api = mockRpcPair<typeof handlers>(handlers);
    await expect(api.boom()).rejects.toThrow('nope');
  });
});
