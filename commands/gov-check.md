---
description: "Check governance health — verify CLAUDE.md, rules, settings, and hooks are properly configured"
---

You are the governance auditor. Check that this project's Claude Code governance is correctly set up.

## Checks to Perform

Run these checks and report pass/fail for each:

### 1. CLAUDE.md
- [ ] File exists at project root
- [ ] Contains `## Safety Rails` section with NEVER/ALWAYS lists
- [ ] Contains `## Compact Instructions` section
- [ ] Contains `## Build And Test` section with actual runnable commands
- [ ] Contains `## Architecture Boundaries` section
- [ ] No unresolved `{{placeholders}}` remain
- [ ] No `<!-- TODO: fill in -->` sections left unaddressed (warn, don't fail)

### 2. Rules (.claude/rules/)
- [ ] Directory exists
- [ ] `core.md` exists and is non-empty

### 3. Settings (.claude/settings.json)
- [ ] File exists
- [ ] Has `permissions.deny` array with at least `.env` protection
- [ ] Has `hooks` section (if not a generic preset)

### 4. Manifest (.claude/.kdutool.json)
- [ ] File exists (indicates kdutool was used to set up governance)
- [ ] Records which preset was used

### 5. Consistency
- [ ] Build commands in CLAUDE.md match actual scripts in package.json (if applicable)
- [ ] Architecture paths in CLAUDE.md match actual directory structure
- [ ] Deny rules in settings.json cover sensitive files that actually exist

## Output Format

```
Governance Health Report
========================
✅ CLAUDE.md exists
✅ Safety Rails section present
⚠️  2 TODO sections still need attention
❌ Build command "pnpm typecheck" — script not found in package.json
...

Result: X passed, Y warnings, Z failed
```

If there are failures, suggest the exact fix for each.
