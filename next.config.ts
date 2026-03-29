import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // Bills API — NetworkFirst with 24h cache for offline viewing
      {
        urlPattern: /^https?:\/\/.*\/api\/bills(\/.*)?$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "bills-api",
          expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
          networkTimeoutSeconds: 10,
        },
      },
      // Other API routes — NetworkOnly (auth-sensitive)
      {
        urlPattern: /^https?:\/\/.*\/api\//,
        handler: "NetworkOnly",
      },
    ],
  },
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "pdf-parse", "pdfjs-dist"],
};

export default withPWA(nextConfig);
