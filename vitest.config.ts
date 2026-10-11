import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["./tests/setup/global-setup.ts"],
    setupFiles: ["./tests/setup/env.ts"],
    // The JSON-backed repository is shared per process: keep test files serial
    // so ingestion/feed tests do not race each other.
    fileParallelism: false,
  },
});
