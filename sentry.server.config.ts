// Sentry server-side init. Loaded by instrumentation.ts register() on the Node runtime.
// No-op without a DSN, so this is inert until SENTRY_DSN is set in the environment.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  // Errors + tracing is the Sentry Next.js baseline: 100% of traces in dev, 10% in prod.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // Privacy: this app's data is people's inner lives. Keep PII off (no user info / HTTP bodies
  // auto-attached), and deliberately DON'T set includeLocalVariables — journal text could ride
  // along in a stack frame otherwise.
  sendDefaultPii: false,
});
