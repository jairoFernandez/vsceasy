import { describe, it, expect, vi } from 'vitest';

// VS Code extension code cannot run inside vitest unless `vscode` is mocked.
// Pattern: extract pure logic into helpers, test those directly.

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});

describe('handler', () => {
  it('mocks vscode for unit tests', () => {
    const vscode = {
      window: { showInformationMessage: vi.fn() },
    };
    vscode.window.showInformationMessage('hi');
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('hi');
  });
});
