import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [{
      test: {
        name: "unit",
        environment: "jsdom",
        include: ["src/**/*.test.{ts,tsx}"],
        exclude: ["node_modules", "dist"]
      }
    }, {
      test: {
        name: "bdd",
        environment: "jsdom",
        include: ["src/**/*.spec.{ts,tsx}"],
        exclude: ["node_modules", "dist"],
        setupFiles: ["./vitest.bdd-setup.ts"]
      }
    }]
  }
});