'use strict';
const path = require('path');
const fs = require('fs');
module.exports = function detectStack(projectDir) {
  const hasFile = (name) => fs.existsSync(path.join(projectDir, name));
  const readJson = (name) => {
    const p = path.join(projectDir, name);
    if (!fs.existsSync(p)) return null;
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
  };
  const pkg = readJson('package.json');
  const hasPom = hasFile('pom.xml');
  const hasGradle = hasFile('build.gradle') || hasFile('build.gradle.kts');
  const hasJava = hasPom || hasGradle;
  const hasVue = !!(
    pkg?.dependencies?.vue ||
    pkg?.devDependencies?.vue ||
    hasFile('vue.config.js') ||
    hasFile('vite.config.ts') ||
    hasFile('vite.config.js') ||
    hasFile('nuxt.config.ts')
  );
  const hasTs = !!(
    hasFile('tsconfig.json') ||
    pkg?.devDependencies?.typescript
  );
  // Determine preset
  if (hasVue && hasJava) {
    return { preset: 'fullstack', display: 'Vue + Java Fullstack', vue: true, java: true, ts: hasTs };
  }
  if (hasVue) {
    return { preset: 'vue-frontend', display: `Vue Frontend${hasTs ? ' (TypeScript)' : ''}`, vue: true, java: false, ts: hasTs };
  }
  if (hasJava) {
    return { preset: 'java-backend', display: `Java Backend (${hasPom ? 'Maven' : 'Gradle'})`, vue: false, java: true, ts: false };
  }
  // Fallback
  return { preset: 'fullstack', display: 'Unknown — using fullstack default', vue: false, java: false, ts: false };
};