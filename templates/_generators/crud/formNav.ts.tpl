/**
 * In-memory hand-off for "open the {{Name}} form to edit row X". The list panel
 * sets the pending id before revealing the form; the form reads (and clears) it
 * on mount. Lives in the extension host, shared across the two panel modules.
 */
type {{Name}}Id = unknown;

let pendingId: {{Name}}Id | null = null;

export function setPending{{Name}}Id(id: {{Name}}Id | null): void {
  pendingId = id ?? null;
}

/** Returns the pending id once, then clears it. */
export function takePending{{Name}}Id(): {{Name}}Id | null {
  const v = pendingId;
  pendingId = null;
  return v;
}
