/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { dataApi } from "./src/plugins/dataApi";

export default defineConfig({
  plugins: [react(), tailwindcss(), dataApi()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    watch: {
      ignored: ["**/data/**"],
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
