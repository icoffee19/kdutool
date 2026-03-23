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
// Multi-repo workspace detection
// ---------------------------------------------------------------------------
function detectSubRepos(projectDir) {
  const repos = [];
  try {
    for (const entry of fs.readdirSync(projectDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const subDir = path.join(projectDir, entry.name);
      if (fs.existsSync(path.join(subDir, '.git'))) {
        const detected = detectPreset(subDir);
        repos.push({ name: entry.name, path: subDir, preset: detected.name, stackName: detected.stackName });
      }
    }
  } catch {}
  return repos;
}

// ---------------------------------------------------------------------------
// Preset composition: parse "vue-frontend+java-backend" into array
// ---------------------------------------------------------------------------
function parsePresetArg(presetArg) {
  if (!presetArg) return null;
  return presetArg.split('+').map(s => s.trim()).filter(Boolean);
}

function mergePresetFiles(presetNames, claudeDir) {
  // Merge rules: concatenate all core.md files
  const rulesDir = path.join(claudeDir, 'rules');
  ensureDir(rulesDir);
  const coreRuleParts = [];
  for (const name of presetNames) {
    const rulesPath = path.join(PRESETS_DIR, name, 'rules', 'core.md');
    if (fs.existsSync(rulesPath)) {
      coreRuleParts.push(fs.readFileSync(rulesPath, 'utf8').trim());
    }
  }
  if (coreRuleParts.length > 0) {
    const dest = path.join(rulesDir, 'core.md');
    if (!fs.existsSync(dest)) {
      fs.writeFileSync(dest, coreRuleParts.join('\n\n') + '\n', 'utf8');
    }
  }

  // Merge settings.partial.json from each preset
  let mergedPartial = {};
  for (const name of presetNames) {
    const partialPath = path.join(PRESETS_DIR, name, 'settings.partial.json');
    if (fs.existsSync(partialPath)) {
      const partial = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
      mergedPartial = deepMergeSettings(mergedPartial, partial);
    }
  }
  return mergedPartial;
}

function mergeClaudeMdTemplates(presetNames) {
  const parts = [];
  for (const name of presetNames) {
    const tpl = path.join(PRESETS_DIR, name, 'CLAUDE.md.template');
    if (fs.existsSync(tpl)) {
      parts.push(fs.readFileSync(tpl, 'utf8').trim());
    }
  }
  if (parts.length <= 1) return parts[0] || '';

  // Merge: combine sections from all templates
  const sections = {};
  const sectionOrder = [];
  for (const content of parts) {
    const lines = content.split('\n');
    let currentSection = '_header';
    let currentLines = [];
    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (currentLines.length > 0) {
          if (!sections[currentSection]) {
            sections[currentSection] = [];
            sectionOrder.push(currentSection);
          }
          sections[currentSection].push(currentLines.join('\n'));
        }
        currentSection = line;
        currentLines = [line];
      } else {
        currentLines.push(line);
      }
    }
    if (currentLines.length > 0) {
      if (!sections[currentSection]) {
        sections[currentSection] = [];
        sectionOrder.push(currentSection);
      }
      sections[currentSection].push(currentLines.join('\n'));
    }
  }

  // Build merged template
  const merged = [];
  for (const section of sectionOrder) {
    const contents = sections[section];
    if (section === '_header') {
      merged.push(contents[0]); // Use first header only
    } else if (contents.length === 1) {
      merged.push(contents[0]);
    } else {
      // Merge: take the section title, combine unique lines
      merged.push(section);
      const seenLines = new Set();
      for (const block of contents) {
        const lines = block.split('\n').slice(1); // skip the ## title
        for (const line of lines) {
          if (line.trim() && !seenLines.has(line.trim())) {
            seenLines.add(line.trim());
            merged.push(line);
          }
        }
      }
    }
  }
  return merged.join('\n');
}

// ---------------------------------------------------------------------------
// Multi-repo CLAUDE.md generator
// ---------------------------------------------------------------------------
function generateMultiRepoClaude(repos, projectDir) {
  const lines = [
    '# Project Contract',
    '',
    '## Repository Structure',
    '',
    'This workspace contains multiple independent git repositories:',
    '',
  ];
  for (const repo of repos) {
    lines.push(`- \`${repo.name}/\` — ${repo.stackName} (independent git repo)`);
  }
  lines.push('');
  lines.push('## Git Rules');
  lines.push('');
  lines.push('- **NEVER** commit across repos in a single commit');
  for (const repo of repos) {
    lines.push(`- ${repo.name} changes: \`cd ${repo.name} && git add/commit\``);
  }
  lines.push('- Each repo has its own branch strategy');
  lines.push('');

  // Build commands per repo
  lines.push('## Build And Test');
  lines.push('');
  for (const repo of repos) {
    lines.push(`### ${repo.name}/ (${repo.stackName})`);
    const tpl = path.join(PRESETS_DIR, repo.preset, 'CLAUDE.md.template');
    if (fs.existsSync(tpl)) {
      const content = fs.readFileSync(tpl, 'utf8');
      // Extract Build section lines
      const match = content.match(/## Build And Test\n([\s\S]*?)(?=\n## )/);
      if (match) {
        for (const line of match[1].trim().split('\n')) {
          if (line.startsWith('- ')) lines.push(line);
        }
      }
    }
    lines.push('');
  }

  // Shared sections
  const sharedDir = path.join(PRESETS_DIR, '_shared');
  const safetyPath = path.join(sharedDir, 'safety-rails.md');
  if (fs.existsSync(safetyPath)) {
    lines.push(fs.readFileSync(safetyPath, 'utf8').trim());
    lines.push('');
  }
  const compactPath = path.join(sharedDir, 'compact-instructions.md');
  if (fs.existsSync(compactPath)) {
    lines.push(fs.readFileSync(compactPath, 'utf8').trim());
    lines.push('');
  }

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Generate multi-repo hooks with cd prefixes
// ---------------------------------------------------------------------------
function generateMultiRepoHooks(repos) {
  const hooks = [];
  for (const repo of repos) {
    const partialPath = path.join(PRESETS_DIR, repo.preset, 'settings.partial.json');
    if (!fs.existsSync(partialPath)) continue;
    const partial = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
    for (const hook of partial?.hooks?.PostToolUse || []) {
      // Prefix pattern with repo dir so hooks only fire for that repo's files
      const adapted = JSON.parse(JSON.stringify(hook));
      if (adapted.pattern) {
        adapted.pattern = `${repo.name}/${adapted.pattern}`;
      }
      // Prefix command with cd
      for (const h of adapted.hooks || []) {
        if (h.command && !h.command.startsWith('cd ')) {
          h.command = `cd ${repo.name} && ${h.command}`;
        }
      }
      hooks.push(adapted);
    }
  }
  return hooks;
}

// ---------------------------------------------------------------------------
// Main install function
// ---------------------------------------------------------------------------
function install(presetArg, flags) {
  const isGlobal = !!flags.global;
  const projectDir = process.cwd();
  const home = process.platform === 'win32'
    ? (process.env.USERPROFILE || process.env.HOME) : process.env.HOME;
  const claudeDir = isGlobal ? path.join(home, '.claude') : path.join(projectDir, '.claude');

  // Check for multi-repo workspace
  const subRepos = detectSubRepos(projectDir);
  if (subRepos.length >= 2 && !presetArg && !isGlobal) {
    return installMultiRepo(subRepos, projectDir, claudeDir, flags);
  }

  // Single-repo install
  const presetNames = parsePresetArg(presetArg);
  const isComposite = presetNames && presetNames.length > 1;

  // 1. Resolve preset(s)
  let resolvedPresets;
  if (isComposite) {
    // Validate all presets exist
    for (const name of presetNames) {
      if (!fs.existsSync(path.join(PRESETS_DIR, name, 'preset.json'))) {
        const avail = listPresets().join(', ');
        console.error(`  ❌ Preset "${name}" not found. Available: ${avail}`);
        process.exit(1);
      }
    }
    resolvedPresets = presetNames;
    const names = presetNames.map(n => {
      const meta = JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, n, 'preset.json'), 'utf8'));
      return meta.stackName;
    });
    console.log(`  📋 Composite install: ${names.join(' + ')}`);
  } else {
    let presetName = presetNames ? presetNames[0] : null;
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
    resolvedPresets = [presetName];
    const meta = JSON.parse(fs.readFileSync(path.join(presetDir, 'preset.json'), 'utf8'));
    console.log(`  📋 Installing preset: ${meta.stackName}`);
  }

  ensureDir(claudeDir);

  // 2. Rules + settings from preset(s)
  if (isComposite) {
    const mergedPartial = mergePresetFiles(resolvedPresets, claudeDir);
    console.log('  ✅ Rules merged → .claude/rules/');

    // Settings merge
    const settingsPath = path.join(claudeDir, 'settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch {}
    }
    const baseSettings = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'settings.base.json'), 'utf8'));
    settings = deepMergeSettings(settings, baseSettings);
    settings = deepMergeSettings(settings, mergedPartial);
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    console.log('  ✅ Settings merged → .claude/settings.json');
  } else {
    // Single preset: copy rules directly
    const rulesDir = path.join(PRESETS_DIR, resolvedPresets[0], 'rules');
    if (fs.existsSync(rulesDir)) {
      copyDirRecursive(rulesDir, path.join(claudeDir, 'rules'));
      console.log('  ✅ Rules → .claude/rules/');
    }

    // Settings merge
    const settingsPath = path.join(claudeDir, 'settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) {
      try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch {}
    }
    const baseSettings = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'settings.base.json'), 'utf8'));
    const partialPath = path.join(PRESETS_DIR, resolvedPresets[0], 'settings.partial.json');
    const partial = fs.existsSync(partialPath) ? JSON.parse(fs.readFileSync(partialPath, 'utf8')) : {};
    settings = deepMergeSettings(settings, baseSettings);
    settings = deepMergeSettings(settings, partial);
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    console.log('  ✅ Settings merged → .claude/settings.json');
  }

  // 3. Copy skills
  const skillsSrc = path.join(TEMPLATES_DIR, 'skills');
  if (fs.existsSync(skillsSrc)) {
    copyDirRecursive(skillsSrc, path.join(claudeDir, 'skills'));
    console.log('  ✅ Skills → .claude/skills/');
  }

  // 4. Copy agents
  const agentsSrc = path.join(TEMPLATES_DIR, 'agents');
  if (fs.existsSync(agentsSrc)) {
    copyDirRecursive(agentsSrc, path.join(claudeDir, 'agents'));
    console.log('  ✅ Agents → .claude/agents/');
  }

  // 5. Copy commands
  const cmdsSrc = path.join(ROOT, 'commands');
  if (fs.existsSync(cmdsSrc)) {
    copyDirRecursive(cmdsSrc, path.join(claudeDir, 'commands', 'kdutool'));
    console.log('  ✅ Commands → .claude/commands/kdutool/  (/kdutool:init, /kdutool:check, /kdutool:adapt)');
  }

  // 6. CLAUDE.md
  if (!isGlobal) {
    const claudeMdDest = path.join(projectDir, 'CLAUDE.md');
    if (!fs.existsSync(claudeMdDest)) {
      if (isComposite) {
        const merged = mergeClaudeMdTemplates(resolvedPresets);
        fs.writeFileSync(claudeMdDest, merged + '\n', 'utf8');
        console.log('  ✅ CLAUDE.md merged from composite presets (run /kdutool:init to adapt)');
      } else {
        const templateSrc = path.join(PRESETS_DIR, resolvedPresets[0], 'CLAUDE.md.template');
        if (fs.existsSync(templateSrc)) {
          fs.copyFileSync(templateSrc, claudeMdDest);
          console.log('  ✅ CLAUDE.md template copied (run /kdutool:init to adapt to project)');
        }
      }
    } else {
      console.log('  ⏭️  CLAUDE.md already exists (run /kdutool:adapt to update)');
    }
  }

  // 7. Copy docs/ai/
  if (!isGlobal) {
    const docsAiSrc = path.join(TEMPLATES_DIR, 'docs-ai');
    if (fs.existsSync(docsAiSrc)) {
      const docsAiDest = path.join(projectDir, 'docs', 'ai');
      copyDirRecursive(docsAiSrc, docsAiDest);
      console.log('  ✅ Architecture docs → docs/ai/');
    }
  }

  // 8. Write manifest
  const manifest = {
    preset: resolvedPresets.join('+'),
    version: require('../package.json').version,
    installedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(claudeDir, '.kdutool.json'),
    JSON.stringify(manifest, null, 2) + '\n', 'utf8'
  );

  // 9. Summary
  const displayName = resolvedPresets.map(n => {
    try {
      return JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, n, 'preset.json'), 'utf8')).stackName;
    } catch { return n; }
  }).join(' + ');
  printSummary(displayName, claudeDir);
}

// ---------------------------------------------------------------------------
// Multi-repo workspace install
// ---------------------------------------------------------------------------
function installMultiRepo(repos, projectDir, claudeDir, flags) {
  console.log(`  🔍 Multi-repo workspace detected (${repos.length} repos):`);
  for (const r of repos) {
    console.log(`     ${r.name}/ → ${r.stackName} (${r.preset})`);
  }

  ensureDir(claudeDir);

  // 1. Merge rules from all repos' presets
  const rulesDir = path.join(claudeDir, 'rules');
  ensureDir(rulesDir);
  const presetNames = [...new Set(repos.map(r => r.preset))];
  mergePresetFiles(presetNames, claudeDir);
  console.log('  ✅ Rules merged from all repos → .claude/rules/');

  // 2. Settings: base + all partial + multi-repo hooks
  const settingsPath = path.join(claudeDir, 'settings.json');
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch {}
  }
  const baseSettings = JSON.parse(fs.readFileSync(path.join(SHARED_DIR, 'settings.base.json'), 'utf8'));
  settings = deepMergeSettings(settings, baseSettings);

  // Add deny rules from each preset
  for (const name of presetNames) {
    const partialPath = path.join(PRESETS_DIR, name, 'settings.partial.json');
    if (fs.existsSync(partialPath)) {
      const partial = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
      // Only merge deny rules, hooks are handled separately
      if (partial.permissions) {
        settings = deepMergeSettings(settings, { permissions: partial.permissions });
      }
    }
  }

  // Generate repo-scoped hooks (cd frontend && mvn compile)
  const multiRepoHooks = generateMultiRepoHooks(repos);
  if (multiRepoHooks.length > 0) {
    if (!settings.hooks) settings.hooks = {};
    if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
    for (const hook of multiRepoHooks) {
      const dup = settings.hooks.PostToolUse.some(h => JSON.stringify(h) === JSON.stringify(hook));
      if (!dup) settings.hooks.PostToolUse.push(hook);
    }
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  console.log('  ✅ Settings merged (repo-scoped hooks) → .claude/settings.json');

  // 3. Skills, agents, commands
  const skillsSrc = path.join(TEMPLATES_DIR, 'skills');
  if (fs.existsSync(skillsSrc)) {
    copyDirRecursive(skillsSrc, path.join(claudeDir, 'skills'));
    console.log('  ✅ Skills → .claude/skills/');
  }
  const agentsSrc = path.join(TEMPLATES_DIR, 'agents');
  if (fs.existsSync(agentsSrc)) {
    copyDirRecursive(agentsSrc, path.join(claudeDir, 'agents'));
    console.log('  ✅ Agents → .claude/agents/');
  }
  const cmdsSrc = path.join(ROOT, 'commands');
  if (fs.existsSync(cmdsSrc)) {
    copyDirRecursive(cmdsSrc, path.join(claudeDir, 'commands', 'kdutool'));
    console.log('  ✅ Commands → .claude/commands/kdutool/');
  }

  // 4. Generate multi-repo CLAUDE.md
  const claudeMdDest = path.join(projectDir, 'CLAUDE.md');
  if (!fs.existsSync(claudeMdDest)) {
    const content = generateMultiRepoClaude(repos, projectDir);
    fs.writeFileSync(claudeMdDest, content, 'utf8');
    console.log('  ✅ CLAUDE.md generated (multi-repo mode)');
  } else {
    console.log('  ⏭️  CLAUDE.md already exists (run /kdutool:adapt to update)');
  }

  // 5. docs/ai/
  const docsAiSrc = path.join(TEMPLATES_DIR, 'docs-ai');
  if (fs.existsSync(docsAiSrc)) {
    copyDirRecursive(docsAiSrc, path.join(projectDir, 'docs', 'ai'));
    console.log('  ✅ Architecture docs → docs/ai/');
  }

  // 6. Manifest
  const manifest = {
    preset: 'multi-repo',
    repos: repos.map(r => ({ name: r.name, preset: r.preset })),
    version: require('../package.json').version,
    installedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(claudeDir, '.kdutool.json'),
    JSON.stringify(manifest, null, 2) + '\n', 'utf8'
  );

  const displayName = repos.map(r => `${r.name}(${r.preset})`).join(' + ');
  printSummary(`Multi-repo: ${displayName}`, claudeDir);
}

// ---------------------------------------------------------------------------
// Uninstall
// ---------------------------------------------------------------------------
function uninstall(flags) {
  const isGlobal = !!flags.global;
  const projectDir = process.cwd();
  const home = process.platform === 'win32'
    ? (process.env.USERPROFILE || process.env.HOME) : process.env.HOME;
  const claudeDir = isGlobal ? path.join(home, '.claude') : path.join(projectDir, '.claude');

  console.log(`  🗑️  kdutool uninstall — ${isGlobal ? 'global' : 'local'} mode\n`);

  // Read manifest to know what was installed
  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(claudeDir, '.kdutool.json'), 'utf8'));
  } catch {}

  if (!manifest) {
    console.log('  ⚠️  No kdutool manifest found — nothing to uninstall');
    return;
  }

  console.log(`  📋 Installed preset: ${manifest.preset}\n`);

  // 1. Remove kdutool commands
  const cmdsDir = path.join(claudeDir, 'commands', 'kdutool');
  if (fs.existsSync(cmdsDir)) {
    fs.rmSync(cmdsDir, { recursive: true });
    console.log('  ✅ Removed .claude/commands/kdutool/');
  }

  // 2. Remove kdutool rules (only core.md that we created)
  const coreRule = path.join(claudeDir, 'rules', 'core.md');
  if (fs.existsSync(coreRule)) {
    fs.unlinkSync(coreRule);
    console.log('  ✅ Removed .claude/rules/core.md');
  }
  // Remove rules dir if empty
  try {
    const rulesDir = path.join(claudeDir, 'rules');
    if (fs.existsSync(rulesDir) && fs.readdirSync(rulesDir).length === 0) fs.rmdirSync(rulesDir);
  } catch {}

  // 3. Remove kdutool skills (only the 4 we installed)
  const ourSkills = ['release-check', 'config-migration', 'runtime-diagnosis', 'incident-triage'];
  for (const skill of ourSkills) {
    const skillDir = path.join(claudeDir, 'skills', skill);
    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true });
    }
  }
  console.log('  ✅ Removed kdutool skills (4)');
  // Remove skills dir if empty
  try {
    const skillsDir = path.join(claudeDir, 'skills');
    if (fs.existsSync(skillsDir) && fs.readdirSync(skillsDir).length === 0) fs.rmdirSync(skillsDir);
  } catch {}

  // 4. Remove kdutool agents (only ours)
  const ourAgents = ['reviewer.md', 'explorer.md'];
  for (const agent of ourAgents) {
    const agentFile = path.join(claudeDir, 'agents', agent);
    if (fs.existsSync(agentFile)) fs.unlinkSync(agentFile);
  }
  console.log('  ✅ Removed kdutool agents (2)');
  try {
    const agentsDir = path.join(claudeDir, 'agents');
    if (fs.existsSync(agentsDir) && fs.readdirSync(agentsDir).length === 0) fs.rmdirSync(agentsDir);
  } catch {}

  // 5. Clean settings.json — remove kdutool entries from deny/hooks
  const settingsPath = path.join(claudeDir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      // Remove base deny rules we added
      const baseDeny = [
        'Read(.env)', 'Read(.env.*)', 'Read(.env.local)',
        'Read(**/secrets/*)', 'Read(**/*credential*)',
        'Read(**/*.pem)', 'Read(**/*.key)',
        'Read(**/application-prod.yml)', 'Read(**/application-prod.properties)',
      ];
      if (settings.permissions?.deny) {
        settings.permissions.deny = settings.permissions.deny.filter(r => !baseDeny.includes(r));
        if (settings.permissions.deny.length === 0) delete settings.permissions.deny;
        if (settings.permissions && Object.keys(settings.permissions).length === 0) delete settings.permissions;
      }

      // Remove PostToolUse hooks with kdutool-identifiable commands
      if (settings.hooks?.PostToolUse) {
        settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(h => {
          const cmds = (h.hooks || []).map(hh => hh.command || '');
          return !cmds.some(c =>
            c.includes('vue-tsc') || c.includes('mvn compile') || c.includes('mvn validate')
          );
        });
        if (settings.hooks.PostToolUse.length === 0) delete settings.hooks.PostToolUse;
      }
      if (settings.hooks && Object.keys(settings.hooks).length === 0) delete settings.hooks;

      if (Object.keys(settings).length === 0) {
        fs.unlinkSync(settingsPath);
        console.log('  ✅ Removed .claude/settings.json (was empty)');
      } else {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
        console.log('  ✅ Cleaned .claude/settings.json (kept non-kdutool entries)');
      }
    } catch {}
  }

  // 6. Remove manifest
  const manifestPath = path.join(claudeDir, '.kdutool.json');
  if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
  console.log('  ✅ Removed manifest');

  // 7. Optionally remove CLAUDE.md
  if (!isGlobal) {
    const claudeMdPath = path.join(projectDir, 'CLAUDE.md');
    if (fs.existsSync(claudeMdPath)) {
      console.log('  ⚠️  CLAUDE.md preserved (delete manually if not needed)');
    }
  }

  console.log('\n  ✅ kdutool uninstall complete\n');
  console.log('  Files preserved:');
  console.log('  - CLAUDE.md (may contain project-specific content)');
  console.log('  - docs/ai/ (may contain project-specific docs)');
  console.log('  - Third-party skills/agents/commands (untouched)');
}

// ---------------------------------------------------------------------------
// Summary printer
// ---------------------------------------------------------------------------
function printSummary(displayName, claudeDir) {
  const hasGSD = fs.existsSync(path.join(claudeDir, 'commands', 'gsd'));
  const hasSP = fs.existsSync(path.join(claudeDir, '..', '.claude-plugin'));
  const engine = hasSP ? 'Superpowers ✅' : hasGSD ? 'GSD ✅' : 'None';
  console.log(`
╔═══════════════════════════════════════════════════════╗
║  kdutool install complete                             ║
║                                                       ║
║  Preset:  ${displayName.substring(0, 43).padEnd(43)}║
║  Engine:  ${engine.padEnd(43)}║
║                                                       ║
║  Next steps:                                          ║
║  1. Run /kdutool:init to adapt CLAUDE.md to project   ║
║  2. Customize .claude/rules/core.md as needed         ║
║  3. Run /kdutool:check to verify everything           ║
╚═══════════════════════════════════════════════════════╝
`);
}

module.exports = { install, uninstall, listPresets, detectPreset };
