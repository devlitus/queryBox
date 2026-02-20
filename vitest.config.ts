/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", ".astro"],
    coverage: {
      provider: "v8",
      include: ["src/utils/**", "src/services/**", "src/stores/**"],
      exclude: [
        "src/**/*.astro",
        "src/pages/**",
        "src/layouts/**",
        // LOW priority: tightly coupled to fetch, not tested in this phase
        "src/services/http-client.ts",
        // LOW priority: trivial single boolean signal, not tested in this phase
        "src/stores/ui-store.ts",
      ],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
    setupFiles: ["./src/test/setup.ts"],
  },
});
