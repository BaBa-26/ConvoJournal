const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
    // Next 14.2: instrumentation.ts (Sentry server/edge init) requires this opt-in.
    instrumentationHook: true,
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",        value: "DENY" },
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "X-DNS-Prefetch-Control",  value: "off" },
          { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",      value: "camera=(), microphone=(self), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // 'unsafe-eval' is only needed for the dev HMR/React-refresh runtime — drop it in
              // prod so an injected inline <script> can't eval(). ('unsafe-inline' stays until a
              // nonce-based CSP lands; Next's bootstrap inline scripts need it without nonces.)
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",          // https: for Google avatar images
              "connect-src 'self'",
              "media-src 'self' blob:",               // blob: for MediaRecorder audio
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          // HSTS — only effective on HTTPS (ignored over HTTP)
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

// Route browser events through a same-origin tunnel (/monitoring) so the CSP `connect-src 'self'`
// needs no Sentry ingest host, and ad-blockers don't drop error reports. Source-map upload only
// runs when SENTRY_AUTH_TOKEN is present (CI/Vercel) — the local build never blocks on it.
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true, // upload a wider set of client files for readable stack traces
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});

