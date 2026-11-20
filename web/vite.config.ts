import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// The shared contracts and fixtures live outside web/. Aliasing them to their sources means the
// web app needs no build step in shared/ and always sees the current contract.
const sharedSrc = fileURLToPath(new URL('../shared/src/', import.meta.url))
const sharedFixtures = fileURLToPath(new URL('../shared/fixtures/', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@leaaf\/shared\/(.*)$/, replacement: `${sharedSrc}$1.ts` },
      { find: /^@leaaf\/fixtures\/(.*)$/, replacement: `${sharedFixtures}$1` },
    ],
  },
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
