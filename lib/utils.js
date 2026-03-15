'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const PRESETS_DIR = path.join(ROOT, 'presets');
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
function copyTemplateDir(src, dest, force) {
  ensureDir(dest);
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTemplateDir(srcPath, destPath, force);
    } else {
      if (!fs.existsSync(destPath) || force) {
        fs.copyFileSync(srcPath, destPath);
        // Preserve executable flag for scripts
        if (entry.name.endsWith('.sh')) {
          try { fs.chmodSync(destPath, 0o755); } catch {}
        }
      }
    }
  }
}
function log(level, msg) {
  const prefix = {
    info: '📋',
    ok: '✅',
    warn: '⚠️ ',
    skip: '⏭️ ',
    error: '❌',
  };
  console.log(`  ${prefix[level] || '  '} ${msg}`);
}
module.exports = { ensureDir, copyTemplateDir, log, ROOT, TEMPLATES_DIR, PRESETS_DIR };