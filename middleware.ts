import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ─── In-memory rate limiter (first layer, all API routes) ─────────────────────
// Sliding-window counter per IP.
// NOTE: On Vercel serverless each function instance has its own Map — this limiter
// is per-instance, not global. It stops naive single-tab bursts for free; the two
// billable AI paths additionally go through the durable Upstash limiter below,
// which IS global across instances. Provider spend caps (Google AI Studio /
// Groq free tier) remain the final backstop.

interface RateWindow {
  count:       number;
  windowStart: number;
}

const store = new Map<string, RateWindow>();

// Billable AI endpoints — keep these low
const LIMITS: Record<string, { max: number; windowMs: number }> = {
  "/api/transcribe": { max: 5,  windowMs: 60_000 },  // 5/min  — Groq Whisper (billable)
  "/api/analyze":    { max: 5,  windowMs: 60_000 },  // 5/min  — Gemini 2.5 Flash (billable)
  default:           { max: 60, windowMs: 60_000 },  // 60/min for everything else
};

// Global hourly cap on billable AI calls across all IPs on this instance.
// Prevents a burst from a rotating-IP attacker from draining the budget.
const AI_PATHS = new Set(["/api/transcribe", "/api/analyze"]);
const GLOBAL_AI_HOURLY_MAX = 200;
let globalAiWindow = { count: 0, windowStart: Date.now() };

function checkGlobalAiCap(path: string): boolean {
  if (!AI_PATHS.has(path)) return true;
  const now = Date.now();
  if (now - globalAiWindow.windowStart > 3_600_000) {
    globalAiWindow = { count: 1, windowStart: now };
    return true;
  }
  globalAiWindow.count += 1;
  return globalAiWindow.count <= GLOBAL_AI_HOURLY_MAX;
}

function checkRateLimit(ip: string, path: string): boolean {
  const rule = LIMITS[path] ?? LIMITS.default;
  const key  = `${ip}:${path}`;
  const now  = Date.now();

  let win = store.get(key);
  if (!win || now - win.windowStart > rule.windowMs) {
    win = { count: 1, windowStart: now };
    store.set(key, win);
    return true;
  }
  win.count += 1;
  return win.count <= rule.max;
}

// ─── Durable (cross-instance) limiter for the billable AI paths ───────────────
// Upstash Redis over REST — edge-compatible, shared by every serverless instance,
// so the caps below are actually global (the in-memory Map above is per-instance).
// Only /api/transcribe and /api/analyze pay the ~10-30ms Redis round-trip.
//
// Fail-open by design: if UPSTASH_* env vars are unset (local dev) or Redis is
// unreachable, we fall back to the in-memory layer instead of taking the app down —
// the provider spend caps still bound the worst case.
// The Vercel Marketplace integration injects KV_REST_API_* names; a manually-created
// Upstash database uses UPSTASH_REDIS_REST_* — accept either.
const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? "";
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? "";

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

// Per-IP: same 5/min as the in-memory rule, but enforced globally.
const aiIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      prefix: "rl:ai:ip",
      timeout: 1000, // slow Redis fails open (counts as success) instead of stalling the request
    })
  : null;

// Global: 200 AI calls/hour across ALL IPs and instances (quota-exhaustion guard).
const aiGlobalLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(GLOBAL_AI_HOURLY_MAX, "3600 s"),
      prefix: "rl:ai:global",
      timeout: 1000,
    })
  : null;

async function checkDurableAiLimit(ip: string, path: string): Promise<boolean> {
  if (!AI_PATHS.has(path) || !aiIpLimiter || !aiGlobalLimiter) return true;
  try {
    const [perIp, global] = await Promise.all([
      aiIpLimiter.limit(`${ip}:${path}`),
      aiGlobalLimiter.limit("all"),
    ]);
    return perIp.success && global.success;
  } catch (err) {
    // Redis down ≠ app down. The in-memory layer already ran; let the request through.
    console.error("[ratelimit] Upstash check failed — falling back to in-memory only", err);
    return true;
  }
}

// ─── Security headers added to every response ─────────────────────────────────

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Frame-Options",           "DENY");
  res.headers.set("X-Content-Type-Options",    "nosniff");
  res.headers.set("X-DNS-Prefetch-Control",    "off");
  res.headers.set("Referrer-Policy",           "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy",        "camera=(), microphone=(self), geolocation=()");
  return res;
}

// ─── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Determine client IP (Vercel / standard headers)
  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  // Rate limit API routes
  if (pathname.startsWith("/api/") && pathname !== "/api/auth") {
    const perIpOk  = checkRateLimit(ip, pathname);
    const globalOk = checkGlobalAiCap(pathname);
    // Cheap in-memory checks first; only when they pass (and only for the two AI
    // paths) pay the Redis round-trip for the durable cross-instance check.
    const durableOk = perIpOk && globalOk ? await checkDurableAiLimit(ip, pathname) : false;
    if (!perIpOk || !globalOk || !durableOk) {
      return applySecurityHeaders(
        new NextResponse(JSON.stringify({ error: "Too many requests" }), {
          status:  429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After":  "60",
          },
        })
      );
    }
  }

  const res = NextResponse.next();
  return applySecurityHeaders(res);
}

export const config = {
  // Run on all routes except static files, Next internals, and the Sentry event tunnel
  // (/monitoring) — the tunnel must reach Sentry unimpeded by rate limiting / headers.
  matcher: [
    "/((?!monitoring|_next/static|_next/image|favicon.ico|icon-.*\\.png).*)",
  ],
};
