# Core Rules — Vue Frontend

## Vue / TypeScript
- Use Vue 3 Composition API with `<script setup lang="ts">`
- Prefer `ref()` / `reactive()` over Options API `data()`
- Composables: `src/composables/useXxx.ts`, always prefix with `use`
- Components: PascalCase filenames, single-file `.vue` components
- Props: define with `defineProps<{ ... }>()` typed interface
- Emits: define with `defineEmits<{ ... }>()` typed interface
- Use `<template>` + `<script setup>` + `<style scoped>` order in SFC
