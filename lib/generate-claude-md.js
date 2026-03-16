'use strict';
const path = require('path');
const fs = require('fs');

/**
 * Generate CLAUDE.md entirely from preset data + project detection.
 * Zero hardcoded stack-specific content — all comes from the preset.
 */
module.exports = function generateClaudeMd(preset, projectDir) {
  const sections = [];

  // --- 1. Build And Test ---
  sections.push(buildSection(preset, projectDir));

  // --- 2. Architecture Boundaries ---
  sections.push(formatSection('Architecture Boundaries', preset.architecture));

  // --- 3. Coding Conventions ---
  sections.push(formatSection('Coding Conventions', preset.conventions));

  // --- 4. Safety Rails ---
  sections.push(safetySection(preset));

  // --- 5. Verification ---
  sections.push(formatSection('Verification', preset.verification));

  // --- 6. GSD Integration (only if GSD is detected) ---
  const gsdDir = path.join(projectDir, '.claude', 'commands', 'gsd');
  if (fs.existsSync(gsdDir)) {
    sections.push([
      '## GSD Integration',
      '- `.planning/` directory is managed by GSD — do not edit manually',
      '- GSD executor agents must follow all Safety Rails above',
      '- Use `/gsd:quick` for bug fixes, full flow for features',
    ].join('\n'));
  }

  // --- 7. Compact Instructions ---
  sections.push([
    '## Compact Instructions',
    'When compressing, preserve in priority order:',
    '1. Architecture decisions and module boundaries (NEVER summarize)',
    '2. Modified files and their key changes',
    '3. Current task/phase status',
    '4. Verification status (pass/fail commands)',
    '5. Open TODOs and rollback notes',
    '6. Tool outputs (can delete, keep pass/fail only)',
  ].join('\n'));

  return '# Project Contract\n\n' + sections.join('\n\n') + '\n';
};

function buildSection(preset, projectDir) {
  const cmds = preset.buildCommands || {};
  const lines = ['## Build And Test'];

  // Try to detect actual package manager from project
  const pkg = tryReadJson(path.join(projectDir, 'package.json'));
  const detectedPm = detectPackageManager(projectDir);

  for (const [layer, layerCmds] of Object.entries(cmds)) {
    lines.push(`### ${capitalize(layer)}`);

    if (layer === 'frontend' && pkg) {
      // Use detected package manager and actual scripts from package.json
      const pm = detectedPm;
      const run = pm === 'npm' ? 'run ' : '';
      if (layerCmds.install) lines.push(`- Install: \`${pm} install\``);
      for (const [key, _] of Object.entries(layerCmds)) {
        if (key === 'install') continue;
        // Check if script actually exists in package.json
        const scriptName = key === 'typecheck' ? (pkg.scripts?.['type-check'] ? 'type-check' : 'typecheck') : key;
        if (pkg.scripts?.[scriptName]) {
          lines.push(`- ${capitalize(key)}: \`${pm} ${run}${scriptName}\``);
        }
      }
    } else {
      // Backend or other layers — use preset commands directly
      for (const [key, val] of Object.entries(layerCmds)) {
        lines.push(`- ${capitalize(key)}: \`${val}\``);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function safetySection(preset) {
  const safety = preset.safety || {};
  const lines = ['## Safety Rails'];

  // Generic NEVER rules (apply to all stacks)
  const genericNever = [
    'Modify `.env`, `.env.local`, or equivalent secrets files without explicit approval',
    'Modify lockfiles manually',
    'Hardcode secrets, tokens, or credentials in source code',
  ];
  const never = [...genericNever, ...(safety.never || [])];
  lines.push('### NEVER');
  for (const item of never) lines.push(`- ${item}`);

  // Generic ALWAYS rules
  const genericAlways = [
    'Show diff before committing',
    'Follow atomic commit convention (feat/fix/docs prefix)',
  ];
  const always = [...genericAlways, ...(safety.always || [])];
  lines.push('### ALWAYS');
  for (const item of always) lines.push(`- ${item}`);

  return lines.join('\n');
}

function formatSection(title, items) {
  if (!items || items.length === 0) {
    return `## ${title}\n<!-- TODO: fill in -->`;
  }
  return `## ${title}\n${items.join('\n')}`;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function tryReadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function detectPackageManager(projectDir) {
  if (fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectDir, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(projectDir, 'bun.lockb'))) return 'bun';
  return 'npm';
}
