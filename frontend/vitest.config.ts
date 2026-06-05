import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    fs: {
      // Allow access to the project root so we can resolve shared files
      allow: [".."],
    },
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      {
        find: /^@openclaw\/protocol\/client-info\.js$/,
        replacement: path.resolve(__dirname, "../src/gateway/protocol/client-info.ts"),
      },
      {
        find: "@openclaw/protocol/schema",
        replacement: path.resolve(__dirname, "../src/gateway/protocol/schema.ts"),
      },
      {
        find: "@openclaw/protocol/index",
        replacement: path.resolve(__dirname, "../src/gateway/protocol/index.ts"),
      },
      { find: "@openclaw", replacement: path.resolve(__dirname, "../src") },
      // Support @dexmart/* with .js extension mapping to .ts
      {
        find: /^@dexmart\/(.*)\.js$/,
        replacement: path.resolve(__dirname, "../src/$1.ts"),
      },
      {
        find: /^@dexmart\/(.*)$/,
        replacement: path.resolve(__dirname, "../src/$1"),
      },
      // Support @DeXMart/shared (case sensitivity fix)
      {
        find: /^@DeXMart\/shared\/(.*)$/,
        replacement: path.resolve(__dirname, "../shared/$1.ts"),
      },
      {
        find: "@DeXMart/shared",
        replacement: path.resolve(__dirname, "../shared/index.ts"),
      },
    ],
    extensions: [".ts", ".js", ".tsx", ".jsx", ".mjs"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    server: {
      deps: {
        inline: ["@tanstack/react-virtual"],
      },
    },
  },
});
