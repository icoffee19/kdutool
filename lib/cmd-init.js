'use strict';
const path = require('path');
const fs = require('fs');
const detectStack = require('./detect-stack');
const mergeSettings = require('./merge-settings');
const generateClaudeMd = require('./generate-claude-md');
const { copyTemplateDir, copyFileIfNeeded, ensureDir, log } = require('./utils');
const {
  TEMPLATES_DIR, SKILL_NAMES, AGENT_FILES,
  getClaudeDir, loadPreset, listPresets, writeManifest,
} = require('./constants');

module.exports = async function cmdInit(flags) {
  const isGlobal = !!flags.global;
  const projectDir = process.cwd();
  const claudeDir = getClaudeDir(isGlobal);

  log('info', `kdutool init — ${isGlobal ? 'global (~/.claude/)' : 'local (./.claude/)'}`);

  // 1. Determine preset
  let presetName = flags.preset;
  if (!presetName && !isGlobal) {
    const detected = detectStack(projectDir);
    presetName = detected.preset;
    log('info', `Detected: ${detected.display} → preset: ${presetName}`);
  }
  if (!presetName) presetName = 'generic';

  const preset = loadPreset(presetName);
  if (!preset) {
    const available = listPresets().join(', ');
    throw new Error(`Preset "${presetName}" not found. Available: ${available}`);
  }

  // 2. Check GSD
  const gsdDir = path.join(claudeDir, 'commands', 'gsd');
  const hasGSD = fs.existsSync(gsdDir);
  if (hasGSD) {
    log('ok', 'GSD detected — will merge settings without overwriting');
  } else {
    log('warn', 'GSD not detected. Recommend: npx get-shit-done-cc --claude --local');
  }

  // 3. Generate rules from preset data
  const rulesDir = path.join(claudeDir, 'rules');
  ensureDir(rulesDir);
  const presetRules = preset.rules || {};
  for (const [filename, lines] of Object.entries(presetRules)) {
    const dest = path.join(rulesDir, filename);
    if (!fs.existsSync(dest) || flags.force) {
      fs.writeFileSync(dest, lines.join('\n') + '\n', 'utf8');
    }
  }
  log('ok', 'Rules installed → .claude/rules/');

  // 4. Copy skills (template files, stack-agnostic)
  const skillsSrc = path.join(TEMPLATES_DIR, 'skills');
  const skillsDest = path.join(claudeDir, 'skills');
  ensureDir(skillsDest);
  let skillCount = 0;
  for (const skill of SKILL_NAMES) {
    const src = path.join(skillsSrc, skill);
    if (fs.existsSync(src)) {
      copyTemplateDir(src, path.join(skillsDest, skill), flags.force);
      skillCount++;
    }
  }
  if (skillCount > 0) {
    log('ok', `Skills installed (${skillCount}) → .claude/skills/`);
  } else {
    log('skip', 'No skill templates found (run kdutool update after upgrading)');
  }

  // 5. Copy agents (only our agents, never touch gsd-* agents)
  const agentsSrc = path.join(TEMPLATES_DIR, 'agents');
  const agentsDest = path.join(claudeDir, 'agents');
  ensureDir(agentsDest);
  let agentCount = 0;
  for (const file of AGENT_FILES) {
    if (copyFileIfNeeded(path.join(agentsSrc, file), path.join(agentsDest, file), flags.force)) {
      agentCount++;
    }
  }
  if (agentCount > 0) {
    log('ok', `Agents installed (${agentCount}) → .claude/agents/`);
  } else {
    log('skip', 'Agents already exist (use --force to overwrite)');
  }

  // 6. Merge settings.json
  mergeSettings(claudeDir, preset);
  log('ok', 'Settings merged → .claude/settings.json');

  // 7. Generate CLAUDE.md (local mode only)
  if (!isGlobal) {
    const claudeMdPath = path.join(projectDir, 'CLAUDE.md');
    if (!fs.existsSync(claudeMdPath) || flags.force) {
      const content = generateClaudeMd(preset, projectDir);
      fs.writeFileSync(claudeMdPath, content, 'utf8');
      log('ok', 'CLAUDE.md generated');
    } else {
      log('skip', 'CLAUDE.md already exists (use --force to overwrite)');
    }
  }

  // 8. Create docs/ai/ templates (local mode only)
  if (!isGlobal) {
    const docsAiSrc = path.join(TEMPLATES_DIR, 'docs-ai');
    if (fs.existsSync(docsAiSrc)) {
      const docsAiDir = path.join(projectDir, 'docs', 'ai');
      ensureDir(docsAiDir);
      copyTemplateDir(docsAiSrc, docsAiDir, flags.force);
      log('ok', 'Architecture docs → docs/ai/');
    }
  }

  // 9. Save manifest (records preset for update/check)
  writeManifest(claudeDir, {
    preset: presetName,
    version: require('../package.json').version,
    installedAt: new Date().toISOString(),
  });

  // 10. Summary
  const modeStr = isGlobal ? 'Global (~/.claude/)' : 'Local (./.claude/)';
  const gsdStr = hasGSD ? 'Detected' : 'Not found — install recommended';
  console.log(`
╔══════════════════════════════════════════════════════╗
║  kdutool init complete                               ║
║                                                      ║
║  Preset:  ${preset.stackName.padEnd(42)}║
║  Mode:    ${modeStr.padEnd(42)}║
║  GSD:     ${gsdStr.padEnd(42)}║
║                                                      ║
║  Next steps:                                         ║
║  1. Review CLAUDE.md and customize for your project  ║
║  2. Customize .claude/rules/ as needed               ║
${hasGSD ? '║  3. Run /gsd:new-project to start building           ║\n' : '║  3. Install GSD: npx get-shit-done-cc --claude --local║\n'}║                                                      ║
╚══════════════════════════════════════════════════════╝
`);
};
