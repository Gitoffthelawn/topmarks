# Plan docs

Lightweight, self-contained HTML documents for **aligning on the approach to a
change before building it**. Think of them as a one-page design overview you can
read, scroll, and share — not a task tracker.

This is a deliberately small convention: no plugin, no tooling, no required
sub-skills. A plan doc exists to get sign-off on *what* and *why*, then to stand
as a record of *what was decided*.

## When to write one

- A feature or refactor big enough that the approach is worth agreeing on first.
- Anything touching multiple files, both extension stores, or user-facing copy.

Skip it for small, obvious fixes — a plan doc shouldn't outweigh the change.

## Convention

| Aspect | Rule |
|--------|------|
| **Location** | `docs/plans/` |
| **Filename** | `YYYY-MM-DD-feature-slug.html` (date the doc was started) |
| **Format** | Self-contained HTML — all CSS inline, so the file is portable on its own (open it, email it, drop it in a gist) |
| **Template** | Copy [`_template.html`](./_template.html) |
| **Status** | A chip in the header: `Proposed → Approved → Built` (or `Superseded`) |

## Status lifecycle

The header carries a status chip; update its `status--*` class as the doc moves:

- **Proposed** — written, awaiting the user's sign-off.
- **Approved** — user agreed on the approach; implementation can start.
- **Built** — the change has landed. The doc now reads as a record.
- **Superseded** — replaced by a later plan (link to it).

## Section skeleton

Use what fits; drop the rest. Don't pad to fill the template.

- **What changes** — the observable behaviour (user-facing or system).
- **Why / context** — the reasoning and constraints a reviewer needs.
- **Approach** — the shape of the change, usually a file-by-file table.
- **Verification** — how you'll know it works (commands, manual checks).
- **Decisions** — choices already settled, each with a one-line reason.
- **Open / to confirm** — anything still needing a call, with the trade-off.

## What this is *not*

No task-by-task checklist with per-step code. That's an executable plan for a
worker; this is an approach doc for a human. If the implementation needs that
level of decomposition, that's what the actual coding session is for.

## Example

[`2026-05-29-folder-emojis.html`](./2026-05-29-folder-emojis.html) — replacing
top-level folder icons with emojis.
