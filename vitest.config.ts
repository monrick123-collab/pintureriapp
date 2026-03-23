import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 15000, // 15s para llamadas reales a Supabase
    exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/tests/e2e/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') }
  }
});
