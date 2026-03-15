'use strict';
const path = require('path');
const fs = require('fs');
const { log } = require('./utils');
const CHECKS = [
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
      return content.includes('## Safety Rails') || content.includes('### NEVER');
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
    name: 'config.md rule exists',
    check: (dir) => fs.existsSync(path.join(dir, '.claude', 'rules', 'config.md')),
    fix: 'Run: npx kdutool init',
  },
  {
    name: 'release.md rule exists',
    check: (dir) => fs.existsSync(path.join(dir, '.claude', 'rules', 'release.md')),
    fix: 'Run: npx kdutool init',
  },
  {
    name: 'Skills directory has release-check',
    check: (dir) => fs.existsSync(path.join(dir, '.claude', 'skills', 'release-check', 'SKILL.md')),
    fix: 'Run: npx kdutool init',
  },
  {
    name: 'Skills directory has runtime-diagnosis',
    check: (dir) => fs.existsSync(path.join(dir, '.claude', 'skills', 'runtime-diagnosis', 'SKILL.md')),
    fix: 'Run: npx kdutool init',
  },
  {
    name: 'settings.json has deny rules for secrets',
    check: (dir) => {
      const p = path.join(dir, '.claude', 'settings.json');
      if (!fs.existsSync(p)) return false;
      const settings = JSON.parse(fs.readFileSync(p, 'utf8'));
      const deny = settings?.permissions?.deny || [];
      return deny.some(r => r.includes('.env'));
    },
    fix: 'Run: npx kdutool init --force (to re-merge settings)',
  },
  {
    name: 'settings.json has PostToolUse hooks',
    check: (dir) => {
      const p = path.join(dir, '.claude', 'settings.json');
      if (!fs.existsSync(p)) return false;
      const settings = JSON.parse(fs.readFileSync(p, 'utf8'));
      return (settings?.hooks?.PostToolUse || []).length > 0;
    },
    fix: 'Run: npx kdutool init --force (to add compilation hooks)',
  },
  {
    name: 'reviewer.md agent exists',
    check: (dir) => fs.existsSync(path.join(dir, '.claude', 'agents', 'reviewer.md')),
    fix: 'Run: npx kdutool init',
  },
  {
    name: 'docs/ai/ directory exists',
    check: (dir) => fs.existsSync(path.join(dir, 'docs', 'ai')),
    fix: 'Run: npx kdutool init',
  },
];
module.exports = async function cmdCheck(flags) {
  const projectDir = process.cwd();
  const isCi = !!flags.ci;
  log('info', 'kdutool check — governance health report\\n');
  let passed = 0;
  let failed = 0;
  const failures = [];
  for (const c of CHECKS) {
    const ok = c.check(projectDir);
    if (ok) {
      passed++;
      console.log(`  ✅ ${c.name}`);
    } else {
      failed++;
      failures.push(c);
      console.log(`  ❌ ${c.name}`);
      console.log(`     Fix: ${c.fix}`);
    }
  }
  console.log(`\\n  Result: ${passed} passed, ${failed} failed out of ${CHECKS.length} checks\\n`);
  if (failed === 0) {
    log('ok', 'All governance checks passed');
  } else {
    log('warn', `${failed} issue(s) found — run suggested fixes above`);
  }
  if (isCi && failed > 0) {
    process.exit(1);
  }
};