#!/usr/bin/env node
'use strict';
const { install, listPresets } = require('../lib/install');
const { check } = require('../lib/check');
const VERSION = require('../package.json').version;

const args = process.argv.slice(2);
const command = args[0];

// --- Parse flags ---
const flags = {};
let positional = null;
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--global' || args[i] === '-g') flags.global = true;
  else if (args[i] === '--ci') flags.ci = true;
  else if (!args[i].startsWith('-')) positional = args[i];
}

// --- Commands ---
if (!command || command === 'help' || command === '--help' || command === '-h') {
  const presets = listPresets().join(' | ');
  console.log(`
kdutool v${VERSION} — Claude Code governance layer (Prompt-first)

Usage:
  kdutool install [preset] [--global]
    Copy governance files into .claude/ and generate CLAUDE.md template.
    Auto-detects tech stack if no preset given.
    Available presets: ${presets}

  kdutool check [--ci]
    Deterministic governance health check (safe for CI).
    For intelligent checks, use /kdutool:check in Claude Code.

  kdutool help
    Show this message.

Workflow:
  npx kdutool install              # 1. Install governance files
  Then in Claude Code:
    /kdutool:init                      # 2. Claude adapts CLAUDE.md to your project
    /kdutool:check                     # 3. Claude verifies everything
    /kdutool:adapt                     # 4. Fix drift after refactoring
`);
} else if (command === 'install') {
  install(positional, flags);
} else if (command === 'check') {
  check(flags);
} else {
  console.error(`Unknown command: ${command}\nRun "kdutool help" for usage.`);
  process.exit(1);
}
