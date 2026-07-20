// Sentry browser-side init (Next.js v9+ convention: this file replaces sentry.client.config.ts).
// Runs once on the client. No-op without a public DSN, so it's inert until NEXT_PUBLIC_SENTRY_DSN
// is set. Browser events are tunneled through same-origin /monitoring (see next.config.js), so the
// CSP `connect-src 'self'` needs no change.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  // Errors + tracing baseline (server request tracing + client navigation spans): 100% of
  // traces in dev, 10% in prod. Session Replay is intentionally NOT enabled yet — it records
  // the DOM, and this is a private journaling surface; add it later behind privacy masking.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  sendDefaultPii: false, // privacy: no PII auto-attached (journal content)
});

// Instruments client-side navigations for error context (no-op when disabled).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
