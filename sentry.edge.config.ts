// Sentry init for the Edge runtime (middleware, edge routes). Loaded by instrumentation.ts.
// No-op without a DSN.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  // Errors + tracing baseline: 100% of traces in dev, 10% in prod.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  sendDefaultPii: false, // privacy: no PII auto-attached (journal content)
});
