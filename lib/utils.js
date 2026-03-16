'use strict';
const path = require('path');
const fs = require('fs');

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
        if (entry.name.endsWith('.sh')) {
          try { fs.chmodSync(destPath, 0o755); } catch {}
        }
      }
    }
  }
}

/**
 * Safely copy a single file. Returns true if copied, false if skipped.
 */
function copyFileIfNeeded(src, dest, force) {
  if (!fs.existsSync(src)) return false;
  if (fs.existsSync(dest) && !force) return false;
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return true;
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

module.exports = { ensureDir, copyTemplateDir, copyFileIfNeeded, log };
