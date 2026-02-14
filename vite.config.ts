import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Time Tracking",
        short_name: "Time",
        description: "Mobile-first PWA for on-site time tracking",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#ffffff",
        background_color: "#ffffff",
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
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache app shell
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],

        // Runtime caching strategies
        runtimeCaching: [
          {
            // Static assets: Cache-first (fast, use cache when available)
            urlPattern: /\.(?:js|css|woff|woff2)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            // Images: Cache-first with longer expiration
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
              },
            },
          },
          {
            // API reads: Stale-while-revalidate (fast, then update)
            urlPattern: /\/api\/.*(?:GET|get)/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // API writes: Network-first with offline fallback
            urlPattern: /\/api\/.*(?:POST|PUT|DELETE|PATCH)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-mutations",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
            },
          },
        ],

        // Skip waiting to activate new service worker immediately
        skipWaiting: true,
        clientsClaim: true,
      },

      // Dev options for testing
      devOptions: {
        enabled: false, // Enable for testing PWA in dev
      },
    }),
  ],
});
