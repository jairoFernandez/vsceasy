---
title: rpc add
description: Add a typed RPC method to a panel.
---

Extend a panel's RPC contract: appends a method to its interface in
`src/shared/api.ts` and adds a handler stub in the panel.

```bash
vsceasy rpc add --panel dashboard --method getStats --returns "Promise<Stats>"
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--panel` | panel id | **Required.** Which panel to extend. |
| `--method` | text | **Required.** Method name. |
| `--params` | text | Param signature, e.g. `id: string, q?: string`. |
| `--returns` | text | Return type. Default `void`. |

## Examples

```bash
# no args, returns a value
vsceasy rpc add --panel dashboard --method getStats --returns "{ total: number }"

# with params
vsceasy rpc add --panel users --method find --params "q: string" --returns "User[]"
```

This adds to both sides:

```ts title="src/shared/api.ts"
export interface DashboardApi {
  getStats(): Promise<{ total: number }>; // ← added
}
```

```ts title="src/panels/dashboard.ts"
rpc: (vscode) => ({
  async getStats() {
    // TODO: implement
    return { total: 0 };
  },
}),
```

Call it from the webview with full typing — see [Typed RPC](/guides/rpc/).
