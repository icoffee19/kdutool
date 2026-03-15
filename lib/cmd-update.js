'use strict';
const path = require('path');
const fs = require('fs');
const { copyTemplateDir, ensureDir, log, TEMPLATES_DIR } = require('./utils');
module.exports = async function cmdUpdate(flags) {
  const isGlobal = !!flags.global;
  const homeDir = process.env.CLAUDE_CONFIG_DIR || (
    process.platform === 'win32'
      ? path.join(process.env.USERPROFILE || process.env.HOME, '.claude')
      : path.join(process.env.HOME, '.claude')
  );
  const claudeDir = isGlobal ? homeDir : path.join(process.cwd(), '.claude');
  if (!fs.existsSync(claudeDir)) {
    throw new Error(`${claudeDir} not found. Run "kdutool init" first.`);
  }
  log('info', `kdutool update — ${isGlobal ? 'global' : 'local'} mode`);
  // Update rules (always overwrite — team rules are authoritative)
  const rulesDir = path.join(claudeDir, 'rules');
  if (fs.existsSync(rulesDir)) {
    copyTemplateDir(path.join(TEMPLATES_DIR, 'rules'), rulesDir, true);
    log('ok', 'Rules updated');
  }
  // Update skills (overwrite SKILL.md and supporting files)
  const skillsDir = path.join(claudeDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    const skillNames = ['release-check', 'config-migration', 'runtime-diagnosis', 'incident-triage'];
    for (const skill of skillNames) {
      const dest = path.join(skillsDir, skill);
      if (fs.existsSync(dest)) {
        copyTemplateDir(path.join(TEMPLATES_DIR, 'skills', skill), dest, true);
      }
    }
    log('ok', 'Skills updated');
  }
  // Update agents (only reviewer + explorer, never touch gsd-* agents)
  const agentsDir = path.join(claudeDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    for (const file of ['reviewer.md', 'explorer.md']) {
      const src = path.join(TEMPLATES_DIR, 'agents', file);
      const dest = path.join(agentsDir, file);
      fs.copyFileSync(src, dest);
    }
    log('ok', 'Agents updated');
  }
  // Do NOT touch: CLAUDE.md, settings.json, docs/ai/, .planning/
  log('skip', 'CLAUDE.md — preserved (project-customized)');
  log('skip', 'settings.json — preserved (run "kdutool init --force" to re-merge)');
  log('ok', `Update complete (kdutool v${require('../package.json').version})`);
};