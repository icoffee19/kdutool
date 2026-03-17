---
description: "Initialize governance config — detect tech stack, install preset, adapt CLAUDE.md to project"
---

You are the governance initializer for this project. Your job is to set up Claude Code governance by analyzing the project and adapting the installed preset template.

## Prerequisites

Before running this command, the user should have run:
```bash
npx kdutool install [preset-name]
```
This copies the base files (rules, skills, agents, settings.json). If .claude/rules/core.md does NOT exist, tell the user to run `npx kdutool install` first.

## Your Job: Intelligent Adaptation

The `kdutool install` command copies a template CLAUDE.md with `{{placeholders}}`. Your job is to replace the template with a project-specific version.

### Step 1: Detect Project Reality

Scan the project to understand:
1. **Package manager**: Check for `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`, or default to `npm`
2. **Actual scripts**: Read `package.json` → `scripts` to find real command names
3. **Actual directory structure**: `ls src/` to see what directories really exist
4. **Backend build tool**: `pom.xml` (Maven) vs `build.gradle` (Gradle)
5. **Existing CLAUDE.md**: If one already exists, merge rather than replace
6. **GSD**: Check if `.claude/commands/gsd/` exists

### Step 2: Generate CLAUDE.md

Read the template at `CLAUDE.md` (installed by `kdutool install`).

Replace placeholders:
- `{{pm}}` → detected package manager (pnpm/yarn/npm/bun)
- `{{run}}` → `run ` for npm, empty string for pnpm/yarn/bun
- `{{safety-rails}}` → contents of `node_modules/kdutool/presets/_shared/safety-rails.md`
- `{{compact-instructions}}` → contents of `node_modules/kdutool/presets/_shared/compact-instructions.md`

Then adapt further:
- Remove build commands whose scripts don't actually exist in package.json
- Update Architecture Boundaries to match actual directory structure
- If GSD is detected, add a `## GSD Integration` section:
  ```
  ## GSD Integration
  - `.planning/` directory is managed by GSD — do not edit manually
  - GSD executor agents must follow all Safety Rails above
  - Use `/gsd:quick` for bug fixes, full flow for features
  ```

### Step 3: Preview and Confirm

Show the user the generated CLAUDE.md content and highlight:
- Sections marked with `<!-- TODO: ... -->` that need manual input
- Architecture paths that may need adjustment
- Any missing test/lint scripts that should be added

Then ask:

```
CLAUDE.md is ready. How would you like to proceed?

1. Apply — write the generated CLAUDE.md
2. Edit first — tell me what to change, then I'll regenerate
3. Skip — keep the current CLAUDE.md unchanged
```

**CRITICAL: Do NOT write CLAUDE.md until the user explicitly replies with their choice.**
- If the user picks option 2, make the requested changes and show the updated version for another round of confirmation.
- If the user picks option 3 or says "no" / "skip", end without writing.
- If the user is silent or unclear, ask again — never assume consent.
