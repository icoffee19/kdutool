'use strict';
const path = require('path');
const fs = require('fs');

/**
 * Deterministic governance checks — safe for CI pipelines.
 * For intelligent checks (command accuracy, architecture drift), use /kdutool:check instead.
 */
function check(flags) {
  const projectDir = process.cwd();
  const claudeDir = path.join(projectDir, '.claude');
  const isCi = !!flags.ci;

  // Read manifest
  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(claudeDir, '.kdutool.json'), 'utf8'));
  } catch {}

  console.log('  📋 kdutool check — governance health report');
  if (manifest) {
    console.log(`  📋 Preset: ${manifest.preset} (v${manifest.version || '?'})\n`);
  } else {
    console.log('  ⚠️  No manifest — run "npx kdutool install" first\n');
  }

  const checks = [
    {
      name: 'CLAUDE.md exists',
      pass: fs.existsSync(path.join(projectDir, 'CLAUDE.md')),
      fix: 'npx kdutool install <preset>',
    },
    {
      name: 'CLAUDE.md has Safety Rails',
      pass: (() => {
        try {
          return fs.readFileSync(path.join(projectDir, 'CLAUDE.md'), 'utf8').includes('Safety Rails');
        } catch { return false; }
      })(),
      fix: 'Run /kdutool:init to generate governance sections',
    },
    {
      name: 'CLAUDE.md has Compact Instructions',
      pass: (() => {
        try {
          return fs.readFileSync(path.join(projectDir, 'CLAUDE.md'), 'utf8').includes('Compact Instructions');
        } catch { return false; }
      })(),
      fix: 'Run /kdutool:init to generate governance sections',
    },
    {
      name: 'No unresolved {{placeholders}}',
      pass: (() => {
        try {
          return !/\{\{.+?\}\}/.test(fs.readFileSync(path.join(projectDir, 'CLAUDE.md'), 'utf8'));
        } catch { return false; }
      })(),
      fix: 'Run /kdutool:init to replace template placeholders',
    },
    {
      name: 'Rules directory exists',
      pass: fs.existsSync(path.join(claudeDir, 'rules')),
      fix: 'npx kdutool install <preset>',
    },
    {
      name: 'core.md rule exists',
      pass: fs.existsSync(path.join(claudeDir, 'rules', 'core.md')),
      fix: 'npx kdutool install <preset>',
    },
    {
      name: 'settings.json has deny rules for secrets',
      pass: (() => {
        try {
          const s = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
          return (s?.permissions?.deny || []).some(r => r.includes('.env'));
        } catch { return false; }
      })(),
      fix: 'npx kdutool install <preset>',
    },
    {
      name: 'Governance commands installed',
      pass: fs.existsSync(path.join(claudeDir, 'commands', 'kdutool')),
      fix: 'npx kdutool install <preset>',
    },
    {
      name: 'Manifest exists',
      pass: !!manifest,
      fix: 'npx kdutool install <preset>',
    },
  ];

  let passed = 0, failed = 0;
  for (const c of checks) {
    if (c.pass) {
      passed++;
      console.log(`  ✅ ${c.name}`);
    } else {
      failed++;
      console.log(`  ❌ ${c.name}`);
      console.log(`     Fix: ${c.fix}`);
    }
  }

  console.log(`\n  Result: ${passed} passed, ${failed} failed out of ${checks.length} checks`);
  if (failed === 0) {
    console.log('  ✅ All governance checks passed\n');
    console.log('  💡 For deeper analysis (command accuracy, architecture drift), run /kdutool:check\n');
  } else {
    console.log(`  ⚠️  ${failed} issue(s) found — run suggested fixes above\n`);
  }

  if (isCi && failed > 0) process.exit(1);
}

module.exports = { check };
