#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');
const COMMANDS = {
  init: require('../lib/cmd-init'),
  update: require('../lib/cmd-update'),
  check: require('../lib/cmd-check'),
  help: printHelp,
};
const VERSION = require('../package.json').version;
function printHelp() {
  console.log(`
kdutool v${VERSION} — Claude Code governance for KDU team
Usage:
  kdutool init [--global] [--preset <name>] [--force]
    Initialize governance config in current project (or globally).
    --global    Install to ~/.claude/ as team baseline
    --preset    Force a preset: vue-frontend | java-backend | fullstack
    --force     Overwrite existing governance files
  kdutool update [--global]
    Update governance rules/skills from latest kdutool.
    Preserves project-customized CLAUDE.md.
  kdutool check [--ci]
    Validate governance config health.
    --ci    Exit with non-zero code on failure (for CI pipelines).
  kdutool help
    Show this message.
Examples:
  npx kdutool init                        # Auto-detect stack, install locally
  npx kdutool init --preset vue-frontend  # Force Vue preset
  npx kdutool init --global               # Install team baseline to ~/.claude/
  npx kdutool check --ci                  # Run in CI pipeline
`);
}
// --- Parse args ---
const args = process.argv.slice(2);
const command = args[0];
const flags = {};
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--global' || args[i] === '-g') flags.global = true;
  else if (args[i] === '--force' || args[i] === '-f') flags.force = true;
  else if (args[i] === '--ci') flags.ci = true;
  else if (args[i] === '--preset' && args[i + 1]) { flags.preset = args[++i]; }
}
if (!command || command === 'help' || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}
if (!COMMANDS[command]) {
  console.error(`Unknown command: ${command}\\nRun "kdutool help" for usage.`);
  process.exit(1);
}
// --- Execute ---
(async () => {
  try {
    await COMMANDS[command](flags);
  } catch (err) {
    console.error(`\\n❌ ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
})();