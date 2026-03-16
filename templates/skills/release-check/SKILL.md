---
name: release-check
description: Use before cutting a release to verify build, tests, and version bump.
---

## Pre-flight (All must pass)

- [ ] Build passes (no compilation errors)
- [ ] All tests pass
- [ ] Linter passes with zero warnings
- [ ] Version bumped in package manifest
- [ ] CHANGELOG updated with release notes

## Steps

1. Run the project's build command
2. Run the project's test command
3. Run the project's lint command
4. Check that version has been updated
5. Check that CHANGELOG has a new entry

## Output

Pass / Fail per item. Any Fail must be fixed before release.
