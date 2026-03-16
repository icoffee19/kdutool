'use strict';
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const PRESETS_DIR = path.join(ROOT, 'presets');
const SHARED_DIR = path.join(PRESETS_DIR, '_shared');
const TEMPLATES_DIR = path.join(ROOT, 'templates');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyDirRecursive(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else if (!fs.existsSync(d)) fs.copyFileSync(s, d);   // never overwrite existing
  }
}

function deepMergeSettings(base, overlay) {
  const result = JSON.parse(JSON.stringify(base));
  for (const [key, val] of Object.entries(overlay)) {
    if (Array.isArray(val)) {
      if (!result[key]) result[key] = [];
      for (const item of val) {
        const dup = result[key].some(e =>
          typeof e === 'string' ? e === item : JSON.stringify(e) === JSON.stringify(item)
        );
        if (!dup) result[key].push(item);
      }
    } else if (typeof val === 'object' && val !== null) {
      if (!result[key]) result[key] = {};
      result[key] = deepMergeSettings(result[key], val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

function listPresets() {
  return fs.readdirSync(PRESETS_DIR)
    .filter(f => {
      if (f.startsWith('_')) return false;
      const fp = path.join(PRESETS_DIR, f);
      return fs.statSync(fp).isDirectory() && fs.existsSync(path.join(fp, 'preset.json'));
    });
}

// ---------------------------------------------------------------------------
// Auto-detect preset by scoring
// ---------------------------------------------------------------------------
function detectPreset(projectDir) {
  const hasFile = n => fs.existsSync(path.join(projectDir, n));
  let pkg = null;
  try { pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8')); } catch {}

  let best = null, bestRatio = 0, bestMatched = 0;

  for (const name of listPresets()) {
    if (name === 'generic') continue;
    const meta = JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, name, 'preset.json'), 'utf8'));
    const files = meta.detect?.files || [];
    const deps = meta.detect?.packageDeps || [];
    const total = files.length + deps.length;
    if (total === 0) continue;

    let matched = 0;
    for (const f of files) if (hasFile(f)) matched++;
    for (const d of deps) if (pkg?.dependencies?.[d] || pkg?.devDependencies?.[d]) matched++;
    if (matched === 0) continue;

    const ratio = matched / total;
    if (ratio > bestRatio || (ratio === bestRatio && matched > bestMatched)) {
      bestRatio = ratio; bestMatched = matched;
      best = { name, stackName: meta.stackName };
    }
  }

  return best || { name: 'generic', stackName: 'Generic Project' };
}

// ---------------------------------------------------------------------------
// Main install function
// ---------------------------------------------------------------------------
function install(presetName, flags) {
  const isGlobal = !!flags.global;
  const projectDir = process.cwd();
  const home = process.platform === 'win32'
    ? (process.env.USERPROFILE || process.env.HOME) : process.env.HOME;
  const claudeDir = isGlobal ? path.join(home, '.claude') : path.join(projectDir, '.claude');

  // 1. Resolve preset
  if (!presetName) {
    const detected = detectPreset(projectDir);
    presetName = detected.name;
    console.log(`  🔍 Detected: ${detected.stackName} → preset: ${presetName}`);
  }

  const presetDir = path.join(PRESETS_DIR, presetName);
  if (!fs.existsSync(path.join(presetDir, 'preset.json'))) {
    const avail = listPresets().join(', ');
    console.error(`  ❌ Preset "${presetName}" not found. Available: ${avail}`);
    process.exit(1);
  }

  const meta = JSON.parse(fs.readFileSync(path.join(presetDir, 'preset.json'), 'utf8'));
  console.log(`  📋 Installing preset: ${meta.stackName}`);

  ensureDir(claudeDir);

  // 2. Copy rules (preset/rules/ → .claude/rules/)
  const rulesDir = path.join(presetDir, 'rules');
  if (fs.existsSync(rulesDir)) {
    copyDirRecursive(rulesDir, path.join(claudeDir, 'rules'));
    console.log('  ✅ Rules → .claude/rules/');
  }

  // 3. Copy skills (templates/skills/ → .claude/skills/) — stack-agnostic
  const skillsSrc = path.join(TEMPLATES_DIR, 'skills');
  if (fs.existsSync(skillsSrc)) {
    copyDirRecursive(skillsSrc, path.join(claudeDir, 'skills'));
    console.log('  ✅ Skills → .claude/skills/');
  }

  // 4. Copy agents (templates/agents/ → .claude/agents/)
  const agentsSrc = path.join(TEMPLATES_DIR, 'agents');
  if (fs.existsSync(agentsSrc)) {
    copyDirRecursive(agentsSrc, path.join(claudeDir, 'agents'));
    console.log('  ✅ Agents → .claude/agents/');
  }

  // 5. Copy commands (commands/ → .claude/commands/gov/) — slash commands for Claude
  const cmdsSrc = path.join(ROOT, 'commands');
  if (fs.existsSync(cmdsSrc)) {
    copyDirRecursive(cmdsSrc, path.join(claudeDir, 'commands', 'gov'));
    console.log('  ✅ Commands → .claude/commands/gov/  (/gov:init, /gov:check, /gov:adapt)');
  }

  // 6. Merge settings.json: base + preset partial + existing (additive)
  const settingsPath = path.join(claudeDir, 'settings.json');
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch {}
  }

  const baseSettings = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'settings.base.json'), 'utf8'));
  const partialPath = path.join(presetDir, 'settings.partial.json');
  const partial = fs.existsSync(partialPath)
    ? JSON.parse(fs.readFileSync(partialPath, 'utf8'))
    : {};

  settings = deepMergeSettings(settings, baseSettings);
  settings = deepMergeSettings(settings, partial);
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  console.log('  ✅ Settings merged → .claude/settings.json');

  // 7. Copy CLAUDE.md.template → CLAUDE.md (only if no CLAUDE.md yet)
  if (!isGlobal) {
    const claudeMdDest = path.join(projectDir, 'CLAUDE.md');
    const templateSrc = path.join(presetDir, 'CLAUDE.md.template');
    if (!fs.existsSync(claudeMdDest) && fs.existsSync(templateSrc)) {
      fs.copyFileSync(templateSrc, claudeMdDest);
      console.log('  ✅ CLAUDE.md template copied (run /gov:init to adapt to project)');
    } else if (fs.existsSync(claudeMdDest)) {
      console.log('  ⏭️  CLAUDE.md already exists (run /gov:adapt to update)');
    }
  }

  // 8. Copy docs/ai/ templates
  if (!isGlobal) {
    const docsAiSrc = path.join(TEMPLATES_DIR, 'docs-ai');
    if (fs.existsSync(docsAiSrc)) {
      const docsAiDest = path.join(projectDir, 'docs', 'ai');
      copyDirRecursive(docsAiSrc, docsAiDest);
      console.log('  ✅ Architecture docs → docs/ai/');
    }
  }

  // 9. Write manifest
  const manifest = {
    preset: presetName,
    version: require('../package.json').version,
    installedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(claudeDir, '.kdutool.json'),
    JSON.stringify(manifest, null, 2) + '\n', 'utf8'
  );

  // 10. Summary
  const hasGSD = fs.existsSync(path.join(claudeDir, 'commands', 'gsd'));
  console.log(`
╔═══════════════════════════════════════════════════════╗
║  kdutool install complete                             ║
║                                                       ║
║  Preset:  ${meta.stackName.padEnd(43)}║
║  GSD:     ${(hasGSD ? 'Detected ✅' : 'Not found').padEnd(43)}║
║                                                       ║
║  Next steps:                                          ║
║  1. Run /gov:init to adapt CLAUDE.md to your project  ║
║  2. Customize .claude/rules/core.md as needed         ║
║  3. Run /gov:check to verify everything               ║
╚═══════════════════════════════════════════════════════╝
`);
}

module.exports = { install, listPresets, detectPreset };
