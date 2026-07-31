---
title: Showcase
description: Real extensions built with vsceasy.
---

Extensions shipped on top of vsceasy. If you build one, open a
[PR](https://github.com/jairoFernandez/vsceasy) or an
[issue](https://github.com/jairoFernandez/vsceasy/issues) and it goes on this
page.

## Code Trainer

**[github.com/jairoFernandez/code-coach](https://github.com/jairoFernandez/code-coach)**

Practise algorithms by *actually typing them*. Code Trainer measures real typing
speed and accuracy while you solve interview problems, refuses to let you paste
your way through, generates fresh exercises with a local Ollama model, and tracks
which patterns you keep failing so the next exercise targets them.

It is the most complete worked example of the framework in the wild, and it
leans on nearly every primitive:

| vsceasy feature | How Code Trainer uses it |
| --------------- | ------------------------ |
| [Typing guards](/guides/editor-surface/#typing-guards) | Practice modes swallow wrong keys, block paste in every mode, and intercept deletions to keep the transcription cursor in sync. |
| [Inline completions](/guides/editor-surface/#inline-completions-ghost-text) | Reference solution as ghost text in *typing target*; model-written ghost text after a 900ms pause in *assisted*. |
| [Completions](/guides/editor-surface/#completions) | IntelliSense that only appears after 700ms of keyboard silence — and costs points. |
| [Decorations](/guides/editor-surface/#decorations) | Dimmed reference text and progress overlays painted over the editor. |
| [Terminals](/guides/editor-surface/#terminals) | Captured `exec` runs the exercise tests and parses the verdict; a visible terminal runs the TDD watcher. |
| [The LLM client](/guides/llm/) | Exercise generation, ghost text, and the *Ask the coach* chat — all against a local model, with auto model resolution and a settings-driven client. |
| [Tree views + subpanels](/guides/sidebar-views/) | Problem catalogue grouped by interview pattern, conversation list, and *Add problems* actions in one container. |
| [Panels + typed RPC](/guides/rpc/) | Dashboard and the *Ask the Coach* chat panel, sharing history with the sidebar over RPC events. |
| [The mini-ORM](/guides/orm/) + [reactivity](/guides/reactivity/) | Problems, sessions, streaks and chat turns persisted as entities; views re-render from `watchEntity`. |
| [Status bar](/commands/statusbar-add/) | Live WPM / accuracy / progress, amber under 85%, day streak between sessions, click for the action menu. |
| [Jobs](/commands/job-add/) + [helpers](/commands/helper-add/) | Habit tracking, config and state helpers. |

Two details worth stealing:

- **Generated exercises are verified by running them.** Every generated or
  imported problem is materialised to a scratch directory and its tests run
  twice — against the reference solution (must pass) and against the starter
  (must fail). Anything else is rejected and regenerated.
- **Retries are repairs, not redos.** On failure the model is shown its own
  output plus the exact complaint, rather than being asked the same question
  again.

## TOML

**[github.com/jairoFernandez/toml_extension](https://github.com/jairoFernandez/toml_extension)**

TOML language support for VS Code: syntax highlighting for `.toml` (plus
`Cargo.lock`, `poetry.lock`, `uv.lock`, `Pipfile`, `Gopkg.lock`), language
configuration, snippets, an opt-in file icon theme, and an opt-in *TOML Dark*
color theme.

The counterweight to Code Trainer — no webview, no React, no RPC. It is a
[`create --type language`](/guides/language-extensions/) project end to end:

| vsceasy feature | How the TOML extension uses it |
| --------------- | ------------------------------ |
| [`create --type language`](/guides/language-extensions/) | The whole skeleton — grammar, `language-configuration.json`, snippets, file icon — scaffolded in one command. |
| [`contributes.extra.json`](/guides/language-extensions/#contributesextrajson) | `languages`, `grammars`, `snippets`, `iconThemes` and `themes` merged into `package.json#contributes` by `gen`. |
| [Scoped token colors](/guides/language-extensions/#scoped-token-colors) | Section/key/date scopes recolored under `source.toml` only, leaving every other language on the user's theme. |
| [`doctor`](/commands/doctor/) | Verifies every referenced grammar / snippet / icon asset exists before packaging. |

Worth stealing: the README explains why the **file icon theme is opt-in** — an
icon theme is global, so activating one replaces *all* workbench file icons, not
just `.toml`. Ship it, don't force it.
