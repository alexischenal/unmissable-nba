import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages only serves files that exist: /next needs its own next/index.html.
// Same page as the home page; the app reads the URL to know which one it is.
function nextPage(): Plugin {
  return {
    name: 'next-page',
    apply: 'build',
    closeBundle() {
      const dist = (p: string) => fileURLToPath(new URL(`./dist/${p}`, import.meta.url));
      mkdirSync(dist('next'), { recursive: true });
      copyFileSync(dist('index.html'), dist('next/index.html'));
    },
  };
}

export default defineConfig({
  plugins: [react(), nextPage()],
});
