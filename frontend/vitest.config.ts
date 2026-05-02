import path from 'node:path';
import { fileURLToPath } from "node:url";

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import react from "@vitejs/plugin-react";
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from "vitest/config";
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./test-support/server-only.ts", import.meta.url))
    },
    tsconfigPaths: true
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/__tests__/**", "src/lib/types.ts"]
    },
    projects: [{
      extends: true,
      test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./vitest.setup.ts"],
        include: ["**/*.{test,spec}.{ts,tsx}"]
      }
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});
