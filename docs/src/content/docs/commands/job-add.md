---
title: job add
description: Add a recurring or event-triggered job.
---

A job runs on a schedule or in response to an event. Pick exactly one trigger.

```bash
vsceasy job add --name sync --every 30s
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--name` | text | **Required.** Job id. |
| `--title` | text | Display title. |
| `--every` | duration | Interval: ms number or `30s` / `5m` / `2h` / `1d`. |
| `--dailyAt` | `HH:MM` | Once per day at local time. |
| `--on` | event | `startup` \| `saveDocument` \| `openDocument` \| `changeActiveEditor` \| `changeConfig`. |
| `--onFile` | glob | Filesystem watcher (create / change / delete). |
| `--minIntervalMs` | number | Throttle re-runs across triggers (persisted in globalState). |

Provide exactly one of `--every`, `--dailyAt`, `--on`, `--onFile`.

## Examples

```bash
# every 30s, also runs on startup
vsceasy job add --name sync --every 30s

# daily at 02:30 local time
vsceasy job add --name nightly --dailyAt "02:30"

# on document save, at most once per hour
vsceasy job add --name index --on saveDocument --minIntervalMs 3600000

# on markdown changes
vsceasy job add --name docs --onFile "**/*.md"
```

```ts title="src/jobs/sync.ts"
import { defineJob } from '../shared/vsceasy';

export default defineJob({
  title: 'Sync',
  schedule: { every: '30s' },
  minIntervalMs: 5000,
  run: async (vscode, ctx) => {
    console.log('[sync] tick', new Date().toISOString());
  },
});
```
