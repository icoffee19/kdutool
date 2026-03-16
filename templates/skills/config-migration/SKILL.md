---
name: config-migration
description: Migrate configuration files safely. Run only when explicitly requested.
disable-model-invocation: true
---

## Steps

1. **Backup**: Copy existing config to `*.bak`
2. **Dry run**: Show what would change without applying
3. **Apply**: Execute migration after user confirms dry run output
4. **Verify**: Run project health checks to confirm migration success

## Rollback

Restore from the `.bak` file created in step 1.

## Safety

- Never migrate production configs without explicit approval
- Always create backup before any modification
- Verify application starts correctly after migration
