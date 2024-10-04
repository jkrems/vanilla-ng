import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // If you want to keep running your existing tests in Node.js, uncomment the next line.
  // 'vite.config.js',
  {
    extends: 'vite.config.js',
    test: {
      setupFiles: [
        './src/testing/setup.ts',
      ],
      browser: {
        enabled: true,
        headless: true,
        name: 'chromium',
        provider: 'playwright',
        // https://playwright.dev
        providerOptions: {},
      },
    },
  },
])
