import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";

function buildId(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  }
}

export default defineConfig({
  define: {
    // Baked into the bundle so the footer can show exactly which build a tab
    // is running — the only reliable way to tell a stale practice tab apart.
    __BUILD_ID__: JSON.stringify(buildId()),
  },  plugins: [
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
        // App shell precached. The ~7MB Verovio WASM chunk and the Tone
        // engine (~330KB) load on first use and are runtime-cached —
        // install stays light, offline works after first audition.
        globPatterns: ["**/*.{js,css,html,png,webmanifest}"],
        globIgnores: ["**/verovio*.js", "**/tone-*.js", "**/*.map"],
        runtimeCaching: [
          {
            urlPattern: /verovio.*\.js$/,
            handler: "CacheFirst",
            options: { cacheName: "verovio-wasm", expiration: { maxEntries: 4 } },
          },
          {
            // Starter pack: NetworkFirst so revisions land, but usable
            // offline once opened ("works at the instrument" requirement).
            urlPattern: /\/starter-pack\.json$/,
            handler: "NetworkFirst",
            options: { cacheName: "starter-pack", networkTimeoutSeconds: 5, expiration: { maxEntries: 2, maxAgeSeconds: 86_400 } },
          },
          {
            // Samples (~2.6 MB): never precached (install would stall), but
            // cached hard after the first audition so the band plays offline.
            urlPattern: /\/samples\/.*\.wav$/,
            handler: "CacheFirst",
            options: {
              cacheName: "samples",
              expiration: { maxEntries: 40, maxAgeSeconds: 2_592_000 },
              rangeRequests: false,
            },
          },
          {
            // Tone chunk (~330KB) — lazy but cached hard after first play.
            urlPattern: /\/assets\/tone-.*\.js$/,
            handler: "CacheFirst",
            options: { cacheName: "tone", expiration: { maxEntries: 4 } },
          },
          {
            urlPattern: /\/assets\/.*\.js$/,
            handler: "CacheFirst",
            options: { cacheName: "app-chunks", expiration: { maxEntries: 40, maxAgeSeconds: 2_592_000 } },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: "dist",
    // No source maps shipped to production (free-tier file budget + not
    // needed for triage; Worker error traces come from Workers Observability).
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      // Stable chunk name so precache exclusion + CacheFirst pattern match
      // across builds (Tone is dynamically imported on first play, ADR-017).
      output: { manualChunks: { tone: ["tone"] } },
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
