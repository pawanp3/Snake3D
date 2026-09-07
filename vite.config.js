import { defineConfig } from 'vite';

// GitHub Pages serves this project from https://pawanp3.github.io/Snake3D/,
// so production assets must be prefixed with the repo name. Dev stays at root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Snake3D/' : '/',
}));
