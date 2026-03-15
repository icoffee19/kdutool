# Core Rules — KDU Team
## Language & Style
### Frontend (Vue / TypeScript)
- Use Vue 3 Composition API with `<script setup lang="ts">`
- Prefer `ref()` / `reactive()` over Options API `data()`
- Composables: `src/composables/useXxx.ts`, always prefix with `use`
- Components: PascalCase filenames, single-file `.vue` components
- Props: define with `defineProps<{ ... }>()` typed interface
- Emits: define with `defineEmits<{ ... }>()` typed interface
### Backend (Java / Spring Boot)
- Classes: PascalCase (`UserService`, `OrderController`)
- Methods/variables: camelCase (`getUserById`, `orderStatus`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- Packages