import { defineConfig } from "vitest/config";
import path from "node:path";

// LD01a: split the suite into two projects so Node-environment API tests
// (under app/api/**) and jsdom-environment component tests (under app/book/**)
// can co-exist with their own globals.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    projects: [
      {
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "."),
          },
        },
        test: {
          name: "node",
          environment: "node",
          globals: false,
          include: [
            "app/api/**/*.{test,spec}.{ts,tsx}",
            "lib/**/*.{test,spec}.{ts,tsx}",
          ],
        },
      },
      {
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "."),
          },
        },
        test: {
          name: "jsdom",
          environment: "jsdom",
          globals: false,
          setupFiles: ["./vitest.setup.ts"],
          include: ["app/book/**/*.{test,spec}.{ts,tsx}"],
        },
      },
    ],
  },
});
