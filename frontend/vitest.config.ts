import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
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
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@openclaw/protocol/client-info.js": path.resolve(
        __dirname,
        "../src/gateway/protocol/client-info.ts",
      ),
      "@openclaw/protocol/schema": path.resolve(__dirname, "../src/gateway/protocol/schema.ts"),
      "@openclaw/protocol/index": path.resolve(__dirname, "../src/gateway/protocol/index.ts"),
      "@openclaw": path.resolve(__dirname, "../src"),
    },
  },
});
