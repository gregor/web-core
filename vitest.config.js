import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only web-core's own suite. The fixture app's tests are run by the CLI from
    // inside the fixture, as part of those smoke tests.
    include: ['test/*.test.ts'],
    // These spawn real toolchains against a fixture app; the default 5s is far too
    // short for a vite build or a tsc run.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
