'use strict';
const path = require('path');
const fs = require('fs');
module.exports = function generateClaudeMd(preset, projectDir) {
  const buildCmds = preset.claudeMd?.buildCommands || {};
  const archHint = preset.claudeMd?.architectureHint || '';
  // Try to detect actual commands from project
  const pkg = tryReadJson(path.join(projectDir, 'package.json'));
  const hasPom = fs.existsSync(path.join(projectDir, 'pom.xml'));
  const hasGradle = fs.existsSync(path.join(projectDir, 'build.gradle'))
    || fs.existsSync(path.join(projectDir, 'build.gradle.kts'));
  let buildSection = '## Build And Test\\n';
  // Frontend commands
  if (pkg) {
    const pm = fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml')) ? 'pnpm'
      : fs.existsSync(path.join(projectDir, 'yarn.lock')) ? 'yarn' : 'npm';
    buildSection += `### Frontend\\n`;
    buildSection += `- Install: \\`${pm} install\\`\\n`;
    if (pkg.scripts?.dev) buildSection += `- Dev: \\`${pm} ${pm === 'npm' ? 'run ' : ''}dev\\`\\n`;
    if (pkg.scripts?.build) buildSection += `- Build: \\`${pm} ${pm === 'npm' ? 'run ' : ''}build\\`\\n`;
    if (pkg.scripts?.test) buildSection += `- Test: \\`${pm} ${pm === 'npm' ? 'run ' : ''}test\\`\\n`;
    if (pkg.scripts?.['type-check'] || pkg.scripts?.typecheck) {
      const cmd = pkg.scripts['type-check'] ? 'type-check' : 'typecheck';
      buildSection += `- Typecheck: \\`${pm} ${pm === 'npm' ? 'run ' : ''}${cmd}\\`\\n`;
    }
    if (pkg.scripts?.lint) buildSection += `- Lint: \\`${pm} ${pm === 'npm' ? 'run ' : ''}lint\\`\\n`;
    buildSection += '\\n';
  } else {
    buildSection += `### Frontend\\n`;
    for (const [key, val] of Object.entries(buildCmds.frontend || {})) {
      buildSection += `- ${capitalize(key)}: \\`${val}\\`\\n`;
    }
    buildSection += '\\n';
  }
  // Backend commands
  if (hasPom || hasGradle) {
    const tool = hasPom ? 'mvn' : './gradlew';
    const toolWin = hasPom ? 'mvn' : 'gradlew.bat';
    buildSection += `### Backend\\n`;
    buildSection += `- Build: \\`${tool} clean package -DskipTests\\` (Windows: \\`${toolWin}\\`)\\n`;
    buildSection += `- Test: \\`${tool} test\\`\\n`;
    buildSection += `- Run: \\`${tool} spring-boot:run\\` or \\`java -jar target/*.jar\\`\\n`;
    buildSection += '\\n';
  } else {
    buildSection += `### Backend\\n`;
    for (const [key, val] of Object.entries(buildCmds.backend || {})) {
      buildSection += `- ${capitalize(key)}: \\`${val}\\`\\n`;
    }
    buildSection += '\\n';
  }
  return `# Project Contract
${buildSection}
## Architecture Boundaries
<!-- TODO: 根据项目实际 src/ 目录结构补充 -->
${archHint || `### Frontend
- Pages/Views: \\`src/views/\\`
- Components: \\`src/components/\\` (公共组件 \\`src/components/common/\\`)
- State management: \\`src/stores/\\` (Pinia)
- API calls: \\`src/api/\\` — 不要在 components 中直接调用后端
- Router: \\`src/router/\\`
- Types: \\`src/types/\\`
### Backend
- Controller: \\`src/main/java/**/controller/\\` — 只做参数校验和调用 Service
- Service: \\`src/main/java/**/service/\\` — 业务逻辑
- Repository/Mapper: \\`src/main/java/**/mapper/\\` — 数据访问
- Entity/Model: \\`src/main/java/**/entity/\\`
- Config: \\`src/main/java/**/config/\\` — Spring 配置`}
## Coding Conventions
### Frontend
- Vue 3 Composition API + \\`<script setup>\\` syntax
- Pinia for state, avoid Vuex
- Use TypeScript strict mode where applicable
- Component naming: PascalCase for files and usage
- Composables in \\`src/composables/\\`, prefix with \\`use\\`
### Backend
- Follow standard Java naming: camelCase methods, PascalCase classes
- RESTful API design, uniform response wrapper
- Use Lombok \\`@Data\\` / \\`@Builder\\` for DTOs
- Exceptions through global handler, not per-controller try-catch
## Safety Rails
### NEVER
- Modify \\`.env\\`, \\`.env.local\\`, or \\`application-prod.yml\\` without explicit approval
- Modify lockfiles (pnpm-lock.yaml / package-lock.json) manually
- Remove feature flags without searching all call sites
- Commit without running frontend lint and backend compile
- Modify files in \\`.planning/\\` manually (GSD manages these)
- Change database migration files after they have been applied
- Expose internal service errors directly to API responses
- Hardcode secrets, tokens, or credentials in source code
### ALWAYS
- Show diff before committing
- Update CHANGELOG.md for user-facing changes
- Run frontend typecheck + lint before marking task done
- Run backend compile (\\`mvn compile\\` or \\`./gradlew classes\\`) after Java edits
- Follow atomic commit convention (feat/fix/docs prefix)
- Add appropriate null checks in Java code
## Verification
- Frontend changes: \\`pnpm typecheck\\` + \\`pnpm lint\\` + \\`pnpm test\\`
- Backend changes: \\`mvn compile\\` + \\`mvn test\\`
- API changes: update API docs and contract tests
- Database changes: verify migration up and down
- UI changes: capture before/after screenshots
## GSD Integration
- \\`.planning/\\` directory is managed by GSD — do not edit manually
- GSD executor agents must follow all Safety Rails above
- Use \\`/gsd:quick\\` for bug fixes, full flow for features
## Compact Instructions
When compressing, preserve in priority order:
1. Architecture decisions and module boundaries (NEVER summarize)
2. Modified files and their key changes
3. Current GSD phase and plan status
4. Verification status (pass/fail commands)
5. Open TODOs and rollback notes
6. Tool outputs (can delete, keep pass/fail only)
`;
};
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function tryReadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}