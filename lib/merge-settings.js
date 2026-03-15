'use strict';
const path = require('path');
const fs = require('fs');
const { ensureDir } = require('./utils');
module.exports = function mergeSettings(claudeDir, preset) {
  ensureDir(claudeDir);
  const settingsPath = path.join(claudeDir, 'settings.json');
  let existing = {};
  if (fs.existsSync(settingsPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      existing = {};
    }
  }
  // --- 1. Permissions: append deny rules, don't touch allow (GSD needs those) ---
  if (!existing.permissions) existing.permissions = {};
  if (!existing.permissions.deny) existing.permissions.deny = [];
  const denyRules = [
    'Read(.env)', 'Read(.env.*)', 'Read(.env.local)',
    'Read(**/secrets/*)',
    'Read(**/*credential*)',
    'Read(**/*.pem)', 'Read(**/*.key)',
    'Read(**/application-prod.yml)', 'Read(**/application-prod.properties)',
  ];
  for (const rule of denyRules) {
    if (!existing.permissions.deny.includes(rule)) {
      existing.permissions.deny.push(rule);
    }
  }
  // --- 2. Hooks: append PostToolUse (GSD uses PostResponse, no conflict) ---
  if (!existing.hooks) existing.hooks = {};
  if (!existing.hooks.PostToolUse) existing.hooks.PostToolUse = [];
  const postToolUseHooks = preset.postToolUseHooks || [];
  for (const hook of postToolUseHooks) {
    const exists = existing.hooks.PostToolUse.some(
      h => h.matcher === hook.matcher && h.pattern === hook.pattern
    );
    if (!exists) {
      existing.hooks.PostToolUse.push(hook);
    }
  }
  // --- 3. Notification hook (cross-platform) ---
  if (!existing.hooks.Notification) existing.hooks.Notification = [];
  const hasNotification = existing.hooks.Notification.some(
    h => h.type === 'command' && (
      (h.command || '').includes('kdutool') ||
      (h.command || '').includes('display notification') ||
      (h.command || '').includes('powershell')
    )
  );
  if (!hasNotification) {
    const isWin = process.platform === 'win32';
    existing.hooks.Notification.push({
      type: 'command',
      command: isWin
        ? 'powershell -Command "[System.Reflection.Assembly]::LoadWithPartialName(\\'System.Windows.Forms\\'); [System.Windows.Forms.MessageBox]::Show(\\'Task completed\\', \\'Claude Code\\')"'
        : "osascript -e 'display notification \\"Task completed\\" with title \\"Claude Code\\"'",
    });
  }
  // --- Write back ---
  fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\\n', 'utf8');
};