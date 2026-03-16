'use strict';
const path = require('path');
const fs = require('fs');
const { PRESETS_DIR } = require('./constants');

module.exports = function detectStack(projectDir) {
  const hasFile = (name) => fs.existsSync(path.join(projectDir, name));
  const readJson = (name) => {
    const p = path.join(projectDir, name);
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
  };

  const pkg = readJson('package.json');

  // Load all presets and score by match ratio (matched / total signals).
  // This ensures a preset with ALL signals present beats one with partial matches.
  // e.g. vue-frontend (2/3 matched) beats fullstack (2/4 matched) when no pom.xml exists.
  const presetFiles = fs.readdirSync(PRESETS_DIR).filter(f => f.endsWith('.json'));
  let bestMatch = null;
  let bestRatio = 0;
  let bestMatched = 0;

  for (const file of presetFiles) {
    const name = file.replace('.json', '');
    if (name === 'generic') continue;

    const preset = JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, file), 'utf8'));
    const detect = preset.detect || {};
    const files = detect.files || [];
    const deps = detect.packageDeps || [];
    const total = files.length + deps.length;
    if (total === 0) continue;

    let matched = 0;
    for (const f of files) { if (hasFile(f)) matched++; }
    for (const dep of deps) {
      if (pkg?.dependencies?.[dep] || pkg?.devDependencies?.[dep]) matched++;
    }

    if (matched === 0) continue;

    const ratio = matched / total;
    // Prefer higher ratio; on tie, prefer more matched signals
    if (ratio > bestRatio || (ratio === bestRatio && matched > bestMatched)) {
      bestRatio = ratio;
      bestMatched = matched;
      bestMatch = { preset: name, stackName: preset.stackName };
    }
  }

  if (bestMatch) {
    return { preset: bestMatch.preset, display: bestMatch.stackName };
  }

  return { preset: 'generic', display: 'No specific stack detected — using generic preset' };
};
