---
description: "Use when reviewing code, PRs, or making changes that touch the package version. Ensures the react-sequent version stays in sync across package.json, llms.txt, SKILL.md, and other human-maintained files whenever it is bumped."
---
# Package Version Alignment

The single source of truth for the package version is the `version` field in the root **`package.json`**. Whenever that version is bumped, every other human-maintained reference to the version must be updated to match — do not leave them out of sync.

## Version-bearing files to check

When the `package.json` version changes, verify (and update if needed) the version in each of these source files:

- `docs/static/llms.txt` — the `- Current version: <x.y.z>` line
- `.github/skills/use-react-sequent/SKILL.md` — the version pin in the `description` frontmatter and any version references in the body
- Any other tracked source that embeds the version (changelogs, API docs, migration notes)

## Review guidance

This is a **preference, not a hard blocker**. When reviewing, do the following:

1. **Flag** any mismatch between `package.json`'s `version` and the version echoed in the files above.
2. Point to the specific stale line(s) so the author can fix them quickly.
3. Leave the final call to the author/reviewer — if they intentionally pinned an older version (e.g. docs describing a published release vs. a working-tree bump), that's acceptable; just confirm the intent.

## Details worth noting

- `docs/build/` artifacts and `storybook-static/` are **build outputs** — do not edit them by hand. They regenerate on the next build.
- `yarn.lock` / `docs/yarn.lock` contain many coincidental `1.1.0`-like strings for **dependencies**; they are unrelated to the package version. Do not flag those.
- When bumping the version, updating `package.json` alone is not enough — search for the old version string across the repo (excluding lockfiles and build artifacts) and update the matching human-maintained references in the same change.
