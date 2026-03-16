'use strict';
const path = require('path');
const fs = require('fs');
const { copyTemplateDir, copyFileIfNeeded, ensureDir, log } = require('./utils');
const {
  TEMPLATES_DIR, SKILL_NAMES, AGENT_FILES,
  getClaudeDir, loadPreset, readManifest, writeManifest,
} = require('./constants');

module.exports = async function cmdUpdate(flags) {
  const isGlobal = !!flags.global;
  const claudeDir = getClaudeDir(isGlobal);

  if (!fs.existsSync(claudeDir)) {
    throw new Error(`${claudeDir} not found. Run "kdutool init" first.`);
  }

  log('info', `kdutool update — ${isGlobal ? 'global' : 'local'} mode`);

  // Read manifest to know which preset was used
  const manifest = readManifest(claudeDir);
  const presetName = manifest?.preset || 'generic';
  const preset = loadPreset(presetName);
  if (preset) {
    log('info', `Preset: ${preset.stackName} (${presetName})`);
  }

  // 1. Update rules from preset data (authoritative — always overwrite)
  const rulesDir = path.join(claudeDir, 'rules');
  if (preset?.rules && fs.existsSync(rulesDir)) {
    for (const [filename, lines] of Object.entries(preset.rules)) {
      fs.writeFileSync(path.join(rulesDir, filename), lines.join('\n') + '\n', 'utf8');
    }
    log('ok', 'Rules updated');
  }

  // 2. Update skills (template files)
  const skillsSrc = path.join(TEMPLATES_DIR, 'skills');
  const skillsDest = path.join(claudeDir, 'skills');
  if (fs.existsSync(skillsDest)) {
    for (const skill of SKILL_NAMES) {
      const src = path.join(skillsSrc, skill);
      const dest = path.join(skillsDest, skill);
      if (fs.existsSync(src) && fs.existsSync(dest)) {
        copyTemplateDir(src, dest, true);
      }
    }
    log('ok', 'Skills updated');
  }

  // 3. Update agents (only ours, never touch gsd-* agents)
  const agentsSrc = path.join(TEMPLATES_DIR, 'agents');
  const agentsDest = path.join(claudeDir, 'agents');
  if (fs.existsSync(agentsDest)) {
    for (const file of AGENT_FILES) {
      copyFileIfNeeded(path.join(agentsSrc, file), path.join(agentsDest, file), true);
    }
    log('ok', 'Agents updated');
  }

  // Do NOT touch: CLAUDE.md, settings.json, docs/ai/, .planning/
  log('skip', 'CLAUDE.md — preserved (project-customized)');
  log('skip', 'settings.json — preserved (run "kdutool init --force" to re-merge)');

  // Update manifest version
  writeManifest(claudeDir, {
    ...(manifest || {}),
    version: require('../package.json').version,
    updatedAt: new Date().toISOString(),
  });

  log('ok', `Update complete (kdutool v${require('../package.json').version})`);
};
