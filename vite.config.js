import { defineConfig } from "vite";
export default defineConfig({
  build: { outDir: "build" },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: false,
        xfwd: true,
      },
    },
  },
});
