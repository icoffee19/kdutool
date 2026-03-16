---
description: "Adapt governance rules to current project state — fix drift between CLAUDE.md and actual project"
---

You are the governance adapter. Your job is to detect and fix drift between the governance configuration and the actual project state.

## When to Use

- After major refactoring (directory structure changed)
- After adding new tech to the stack (e.g., added a backend to a frontend project)
- After upgrading frameworks (e.g., Vue 2 → Vue 3)
- When `/kdutool:check` reports consistency failures

## Steps

### Step 1: Analyze Current State

1. Read `CLAUDE.md` and `.claude/rules/core.md`
2. Scan actual project:
   - `ls -la src/` (and key subdirectories)
   - Read `package.json` scripts
   - Check for backend build files (`pom.xml`, `build.gradle`, `go.mod`, `Cargo.toml`)
   - Check for config files (`.eslintrc*`, `tsconfig.json`, `prettier.config.*`)

### Step 2: Identify Drift

Compare and report:

| Area | CLAUDE.md Says | Reality | Action |
|------|---------------|---------|--------|
| Directory structure | src/views/ | Directory doesn't exist | Update or remove |
| Build command | pnpm typecheck | Script not in package.json | Fix command name |
| Package manager | pnpm | yarn.lock found | Switch to yarn |
| Safety rule | application-prod.yml | File doesn't exist | Remove rule |

### Step 3: Propose Changes

For each drift item, show the specific change as a diff:

```diff
- - Typecheck: `pnpm type-check`
+ - Typecheck: `pnpm typecheck`
```

### Step 4: Apply

Apply changes ONLY after the user confirms. Never auto-modify governance files without confirmation.

Also check if the current preset is still the best match:
- If the project now has both frontend and backend, suggest switching from `vue-frontend` to `fullstack`
- If a backend was removed, suggest switching to frontend-only preset
