## Safety Rails

### NEVER
- Modify `.env`, `.env.local`, or equivalent secrets files without explicit approval
- Modify lockfiles manually
- Hardcode secrets, tokens, or credentials in source code

### ALWAYS
- Show diff before committing
- Follow atomic commit convention (feat/fix/docs prefix)
