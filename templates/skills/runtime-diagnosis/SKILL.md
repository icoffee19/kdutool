---
name: runtime-diagnosis
description: Use when the application crashes, hangs, or behaves unexpectedly at runtime.
---

## Evidence Collection

1. Collect application logs (last 50 lines)
2. Check process status and resource usage
3. Review recent code changes (`git log --oneline -10`)
4. Check configuration files for issues

## Decision Matrix

| Symptom | First Check |
|---|---|
| Crash on startup | Config errors, missing dependencies |
| Runtime exception | Stack trace → root module |
| Performance issue | Resource usage, database queries |
| Unexpected behavior | Recent changes, config drift |

## Output Format

- **Root cause**: What went wrong
- **Blast radius**: What is affected
- **Fix steps**: How to resolve
- **Verification**: Command to confirm the fix
