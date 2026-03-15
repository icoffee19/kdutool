'use strict';
const path = require('path');
const fs = require('fs');
const detectStack = require('./detect-stack');
const mergeSettings = require('./merge-settings');
const generateClaudeMd = require('./generate-claude-md');
const { copyTemplateDir, ensureDir, log, PRESETS_DIR, TEMPLATES_DIR } = require('./utils');
module.exports = async function cmdInit(flags) {
  const isGlobal = !!flags.global;
  const homeDir = process.env.CLAUDE_CONFIG_DIR || (
    process.platform === 'win32'
      ? path.join(process.env.USERPROFILE || process.env.HOME, '.claude')
      : path.join(process.env.HOME, '.claude')
  );
  const projectDir = process.cwd();
  const claudeDir = isGlobal ? homeDir : path.join(projectDir, '.claude');
  log('info', `kdutool init — ${isGlobal ? 'global' : 'local'} mode`);
  // 1. Detect stack
  let presetName = flags.preset;
  if (!presetName && !isGlobal) {
    const detected = detectStack(projectDir);
    presetName = detected.preset;
    log('info', `Detected stack: ${detected.display} → preset: ${presetName}`);
  }
  if (!presetName) presetName = 'fullstack';
  const presetPath = path.join(PRESETS_DIR, `${presetName}.json`);
  if (!fs.existsSync(presetPath)) {
    throw new Error(`Preset "${presetName}" not found. Available: vue-frontend, java-backend, fullstack`);
  }
  const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
  // 2. Check GSD installed
  const gsdDir = path.join(claudeDir, 'commands', 'gsd');
  const hasGSD = fs.existsSync(gsdDir);
  if (hasGSD) {
    log('ok', 'GSD detected — will merge settings without overwriting');
  } else {
    log('warn', 'GSD not detected. Recommend: npx get-shit-done-cc --claude --local');
  }
  // 3. Copy rules
  const rulesDir = path.join(claudeDir, 'rules');
  ensureDir(rulesDir);
  copyTemplateDir(path.join(TEMPLATES_DIR, 'rules'), rulesDir, flags.force);
  log('ok', 'Rules installed → .claude/rules/');
  // 4. Copy skills
  const skillsDir = path.join(claudeDir, 'skills');
  ensureDir(skillsDir);
  const skillNames = ['release-check', 'config-migration', 'runtime-diagnosis', 'incident-triage'];
  for (const skill of skillNames) {
    copyTemplateDir(
      path.join(TEMPLATES_DIR, 'skills', skill),
      path.join(skillsDir, skill),
      flags.force
    );
  }
  log('ok', 'Skills installed → .claude/skills/');
  // 5. Copy agents (reviewer + explorer only, don't touch gsd-* agents)
  const agentsDir = path.join(claudeDir, 'agents');
  ensureDir(agentsDir);
  const agentFiles = ['reviewer.md', 'explorer.md'];
  for (const file of agentFiles) {
    const src = path.join(TEMPLATES_DIR, 'agents', file);
    const dest = path.join(agentsDir, file);
    if (!fs.existsSync(dest) || flags.force) {
      fs.copyFileSync(src, dest);
    }
  }
  log('ok', 'Agents installed → .claude/agents/');
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
    const docsAiDir = path.join(projectDir, 'docs', 'ai');
    ensureDir(docsAiDir);
    copyTemplateDir(path.join(TEMPLATES_DIR, 'docs-ai'), docsAiDir, flags.force);
    log('ok', 'Architecture docs → docs/ai/');
  }
  // 9. Summary
  console.log(`
╔══════════════════════════════════════════════════════╗
║  ✅ kdutool init complete                            ║
║                                                      ║
║  Preset:  ${preset.stackName.padEnd(42)}║
║  Mode:    ${(isGlobal ? 'Global (~/.claude/)' : 'Local (./.claude/)').padEnd(42)}║
║  GSD:     ${(hasGSD ? 'Detected ✓' : 'Not found — install recommended').padEnd(42)}║
║                                                      ║
║  Next steps:                                         ║
║  1. Review CLAUDE.md and fill Architecture Boundaries║
║  2. Customize .claude/rules/ for your project        ║
${hasGSD ? '║  3. Run /gsd:new-project to start building           ║\\n' : '║  3. Install GSD: npx get-shit-done-cc --claude --local║\\n'}║                                                      ║
╚══════════════════════════════════════════════════════╝
`);
};