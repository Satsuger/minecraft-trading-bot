import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "apps/frontend",
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../../dist/apps/frontend",
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 4200,
    proxy: {
      "/viewer": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      "@minecraft-trading-bot/constants": "/libs/constants/src/index.ts",
      "@minecraft-trading-bot/types": "/libs/types/src/index.ts",
      "@minecraft-trading-bot/utils": "/libs/utils/src/index.ts",
    },
  },
});
