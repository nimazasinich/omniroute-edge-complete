import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/server/__tests__/topology.test.ts',
    ],
  },
});
