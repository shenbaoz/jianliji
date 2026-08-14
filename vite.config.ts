import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  build: {
    emptyOutDir: true,
    target: "es2020",
    cssMinify: "esbuild",
    cssCodeSplit: true,
    minify: "esbuild",
    assetsInlineLimit: 8192,
    reportCompressedSize: false,
    modulePreload: {
      polyfill: true,
      resolveDependencies: (filename, deps) =>
        deps.filter((dep) => !dep.includes("admin") || filename.includes("admin"))
    },
    rollupOptions: {
      input: {
        app: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin.html")
      },
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (!normalizedId.includes("node_modules")) return;
          if (normalizedId.includes("node_modules/lucide-react")) return "vendor-icons";
          if (/node_modules\/(?:react|react-dom|scheduler)\//.test(normalizedId)) return "vendor-react";
          if (normalizedId.includes("node_modules")) return "vendor-common";
        }
      }
    }
  }
});
