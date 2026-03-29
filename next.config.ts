import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  workboxOptions: {
    skipWaiting: true,
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

export default withSentryConfig(withPWA(nextConfig), {
  // Sentry org/project (set in CI / Vercel env for source map uploads)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: !process.env.CI,          // suppress build output locally
  disableLogger: true,
  automaticVercelMonitors: true,    // Vercel Cron Job monitoring

  // Source maps: upload in CI/production, hide from browser bundle
  sourcemaps: {
    disable: false,
  },
  widenClientFileUpload: true,
});
