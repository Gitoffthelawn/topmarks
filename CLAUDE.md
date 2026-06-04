# Topmarks — project instructions

## Plan docs

When asked to **plan, design, or propose an approach** for a non-trivial change
(and to "present a plan before doing changes"), produce a **plan doc** in
`docs/plans/`:

- Plain Markdown at `docs/plans/YYYY-MM-DD-feature-slug.md` (date the doc was
  started). See the existing docs in that folder for the shape.
- It's an **approach doc for sign-off**, not a task-by-task checklist —
  describe what & why, the shape of the change, and the decisions.
- Open with a one-line title, a `>` blockquote summary, and a `**Status:**`
  line. Set the status to **Proposed**; move it to **Approved** once the user
  agrees, and **Built** after the change lands.

Skip the doc for small, obvious fixes — it shouldn't outweigh the change.
