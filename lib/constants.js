'use strict';
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const PRESETS_DIR = path.join(ROOT, 'presets');

const SKILL_NAMES = ['release-check', 'config-migration', 'runtime-diagnosis', 'incident-triage'];
const AGENT_FILES = ['reviewer.md', 'explorer.md'];

// Manifest file records which preset was used, for update/check commands
const MANIFEST_FILE = '.kdutool.json';

function getClaudeHome() {
  if (process.env.CLAUDE_CONFIG_DIR) return process.env.CLAUDE_CONFIG_DIR;
  const home = process.platform === 'win32'
    ? (process.env.USERPROFILE || process.env.HOME)
    : process.env.HOME;
  return path.join(home, '.claude');
}

function getClaudeDir(isGlobal) {
  return isGlobal ? getClaudeHome() : path.join(process.cwd(), '.claude');
}

function loadPreset(name) {
  const presetPath = path.join(PRESETS_DIR, `${name}.json`);
  if (!fs.existsSync(presetPath)) return null;
  return JSON.parse(fs.readFileSync(presetPath, 'utf8'));
}

function listPresets() {
  return fs.readdirSync(PRESETS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

function readManifest(claudeDir) {
  const p = path.join(claudeDir, MANIFEST_FILE);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function writeManifest(claudeDir, data) {
  const p = path.join(claudeDir, MANIFEST_FILE);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// Base deny rules applied to ALL presets (security baseline)
const BASE_DENY_RULES = [
  'Read(.env)', 'Read(.env.*)', 'Read(.env.local)',
  'Read(**/secrets/*)',
  'Read(**/*credential*)',
  'Read(**/*.pem)', 'Read(**/*.key)',
];

module.exports = {
  ROOT, TEMPLATES_DIR, PRESETS_DIR,
  SKILL_NAMES, AGENT_FILES, MANIFEST_FILE,
  BASE_DENY_RULES,
  getClaudeHome, getClaudeDir, loadPreset, listPresets,
  readManifest, writeManifest,
};
