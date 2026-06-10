import { NextRequest, NextResponse } from "next/server";

// ─── In-memory rate limiter ────────────────────────────────────────────────────
// Simple sliding-window counter per IP. Resets per window.
// Good enough for a small personal/family deployment without Redis.

interface RateWindow {
  count:      number;
  windowStart: number;
}

const store = new Map<string, RateWindow>();

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  "/api/transcribe": { max: 5,  windowMs: 60_000 },  // 5/min — Whisper calls are expensive
  "/api/analyze":   { max: 20, windowMs: 60_000 },  // 20/min — local parser, cheap
  default:          { max: 60, windowMs: 60_000 },  // 60/min for everything else
};

function checkRateLimit(ip: string, path: string): boolean {
  const rule = LIMITS[path] ?? LIMITS.default;
  const key  = `${ip}:${path}`;
  const now  = Date.now();

  let win = store.get(key);
  if (!win || now - win.windowStart > rule.windowMs) {
    win = { count: 1, windowStart: now };
    store.set(key, win);
    return true; // allowed
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
    const allowed = checkRateLimit(ip, pathname);
    if (!allowed) {
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
