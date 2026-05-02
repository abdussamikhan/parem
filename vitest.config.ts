import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    setupFiles:  ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include:  ['app/lib/**', 'app/api/**'],
      exclude:  ['app/lib/prisma.ts'],
    },
    // Sequential execution to avoid DB mock race conditions
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
