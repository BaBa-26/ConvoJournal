import { NextRequest, NextResponse } from "next/server";

// ─── In-memory rate limiter ────────────────────────────────────────────────────
// Sliding-window counter per IP.
// NOTE: On Vercel serverless each function instance has its own Map — this limiter
// is per-instance, not global. It is still effective against single-IP bursts on
// the same instance. For hard global limits, set a spending cap in Google AI Studio
// and Groq dashboard directly.

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

export function middleware(req: NextRequest) {
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
    if (!perIpOk || !globalOk) {
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
  // Run on all routes except static files and Next internals
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png).*)",
  ],
};
