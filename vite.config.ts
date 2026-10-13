import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "LickLab",
        short_name: "LickLab",
        start_url: "/",
        display: "standalone",
        background_color: "#0b0b0f",
        theme_color: "#0b0b0f",
        description: "Store jazz licks and try them over real standards.",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        // App shell precached. The ~7MB Verovio WASM chunk is on-demand +
        // runtime-cached (keeps install light; still fully offline after first view).
        globPatterns: ["**/*.{js,css,html,png,webmanifest}"],
        globIgnores: ["**/verovio*.js", "**/*.map"],
        runtimeCaching: [
          {
            urlPattern: /verovio.*\.js$/,
            handler: "CacheFirst",
            options: { cacheName: "verovio-wasm", expiration: { maxEntries: 4 } },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: "dist",
    sourcemap: true,
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
