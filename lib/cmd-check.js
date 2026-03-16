'use strict';
const path = require('path');
const fs = require('fs');
const { log } = require('./utils');
const { readManifest, getClaudeDir } = require('./constants');

/**
 * Build checks dynamically based on what was actually installed.
 * Avoids false failures for presets that don't include certain files.
 */
function buildChecks(manifest) {
  const checks = [
    // --- Always check ---
    {
      name: 'CLAUDE.md exists',
      check: (dir) => fs.existsSync(path.join(dir, 'CLAUDE.md')),
      fix: 'Run: npx kdutool init',
    },
    {
      name: 'CLAUDE.md has Safety Rails',
      check: (dir) => {
        const p = path.join(dir, 'CLAUDE.md');
        if (!fs.existsSync(p)) return false;
        const content = fs.readFileSync(p, 'utf8');
        return content.includes('Safety Rails') || content.includes('NEVER');
      },
      fix: 'Add ## Safety Rails section with NEVER/ALWAYS lists',
    },
    {
      name: 'CLAUDE.md has Compact Instructions',
      check: (dir) => {
        const p = path.join(dir, 'CLAUDE.md');
        if (!fs.existsSync(p)) return false;
        return fs.readFileSync(p, 'utf8').includes('Compact Instructions');
      },
      fix: 'Add ## Compact Instructions section to preserve context during compression',
    },
    {
      name: 'Rules directory exists',
      check: (dir) => fs.existsSync(path.join(dir, '.claude', 'rules')),
      fix: 'Run: npx kdutool init',
    },
    {
      name: 'core.md rule exists',
      check: (dir) => fs.existsSync(path.join(dir, '.claude', 'rules', 'core.md')),
      fix: 'Run: npx kdutool init (or npx kdutool update)',
    },
    {
      name: 'settings.json has deny rules for secrets',
      check: (dir) => {
        const p = path.join(dir, '.claude', 'settings.json');
        if (!fs.existsSync(p)) return false;
        try {
          const settings = JSON.parse(fs.readFileSync(p, 'utf8'));
          const deny = settings?.permissions?.deny || [];
          return deny.some(r => r.includes('.env'));
        } catch { return false; }
      },
      fix: 'Run: npx kdutool init --force (to re-merge settings)',
    },
    {
      name: 'Manifest (.kdutool.json) exists',
      check: (dir) => fs.existsSync(path.join(dir, '.claude', '.kdutool.json')),
      fix: 'Run: npx kdutool init (to generate manifest)',
    },
  ];

  // --- Conditional checks based on preset ---
  const presetName = manifest?.preset || 'unknown';

  // Only check for PostToolUse hooks if the preset defines them
  if (presetName !== 'generic') {
    checks.push({
      name: 'settings.json has PostToolUse hooks',
      check: (dir) => {
        const p = path.join(dir, '.claude', 'settings.json');
        if (!fs.existsSync(p)) return false;
        try {
          const settings = JSON.parse(fs.readFileSync(p, 'utf8'));
          return (settings?.hooks?.PostToolUse || []).length > 0;
        } catch { return false; }
      },
      fix: 'Run: npx kdutool init --force (to add compilation hooks)',
    });
  }

  // Check skills if templates exist
  const skillsExist = fs.existsSync(path.join(dir(), 'skills'));
  if (skillsExist) {
    checks.push({
      name: 'At least one skill installed',
      check: (dir) => {
        const skillsDir = path.join(dir, '.claude', 'skills');
        if (!fs.existsSync(skillsDir)) return false;
        const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
        return entries.some(e => e.isDirectory() && fs.existsSync(path.join(skillsDir, e.name, 'SKILL.md')));
      },
      fix: 'Run: npx kdutool init',
    });
  }

  return checks;

  function dir() {
    return path.join(__dirname, '..', 'templates');
  }
}

module.exports = async function cmdCheck(flags) {
  const projectDir = process.cwd();
  const isCi = !!flags.ci;
  const claudeDir = path.join(projectDir, '.claude');
  const manifest = readManifest(claudeDir);

  log('info', 'kdutool check — governance health report');
  if (manifest) {
    log('info', `Preset: ${manifest.preset} (v${manifest.version || '?'})\n`);
  } else {
    log('warn', 'No manifest found — run "npx kdutool init" first\n');
  }

  const checks = buildChecks(manifest);
  let passed = 0;
  let failed = 0;

  for (const c of checks) {
    const ok = c.check(projectDir);
    if (ok) {
      passed++;
      console.log(`  ✅ ${c.name}`);
    } else {
      failed++;
      console.log(`  ❌ ${c.name}`);
      console.log(`     Fix: ${c.fix}`);
    }
  }

  console.log(`\n  Result: ${passed} passed, ${failed} failed out of ${checks.length} checks\n`);

  if (failed === 0) {
    log('ok', 'All governance checks passed');
  } else {
    log('warn', `${failed} issue(s) found — run suggested fixes above`);
  }

  if (isCi && failed > 0) {
    process.exit(1);
  }
};
