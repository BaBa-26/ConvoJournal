const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suppress the X-Powered-By: Next.js response header so the stack isn't advertised.
  poweredByHeader: false,

  // Next 15 renamed this out of `experimental` (was serverComponentsExternalPackages).
  serverExternalPackages: ["@prisma/client", "prisma"],

  // NOTE: `experimental.instrumentationHook` is gone in Next 15 — instrumentation.ts
  // (Sentry server/edge init) is enabled by default now, so the opt-in was removed.

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
          // NO Content-Security-Policy here. The CSP is nonce-based and therefore
          // per-request, so it can only be built in middleware.ts. A second static CSP
          // header would be INTERSECTED with it by the browser, and this one's
          // `script-src 'self'` would fight the nonce policy. Keep CSP in one place.
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

