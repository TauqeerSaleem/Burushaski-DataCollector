import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 800,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      strategies: "injectManifest",
      injectManifest: {
        swSrc: "public/sw.js",
        swDest: "dist/sw.js",
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'], // Add this
        maximumFileSizeToCacheInBytes: 5000000, // Add this (5MB)
      },
      manifest: {
        name: "Burushaski Audio Collection",
        short_name: "Burushaski",
        description: "Offline audio data collection app",
        theme_color: "#0f172a",
        background_color: "#000000",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
          },
          {
            urlPattern: ({ request }) =>
              request.destination === "script" ||
              request.destination === "style",
            handler: "StaleWhileRevalidate",
          },
          {
            urlPattern: /sentences_.*\.json/,
            handler: "CacheFirst",
          },
        ],
      },
    }),
  ],
});
