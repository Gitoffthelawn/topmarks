# Topmarks — project instructions

## Plan docs

When asked to **plan, design, or propose an approach** for a non-trivial change
(and to "present a plan before doing changes"), produce a **plan doc** following
the convention in [`docs/plans/README.md`](./docs/plans/README.md):

- Copy [`docs/plans/_template.html`](./docs/plans/_template.html) to
  `docs/plans/YYYY-MM-DD-feature-slug.html` and fill it in.
- Self-contained HTML, inline CSS — keep it portable on its own.
- It's an **approach doc for sign-off**, not a task-by-task checklist.
- Set the header status chip to **Proposed**; move it to **Approved** once the
  user agrees, and **Built** after the change lands.

Skip the doc for small, obvious fixes — it shouldn't outweigh the change.
