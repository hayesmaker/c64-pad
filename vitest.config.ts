import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts so the Start/Nitro plugins don't load in tests.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
