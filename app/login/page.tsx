"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [devEmail, setDevEmail]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Already signed in → go home
  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    await signIn("google", { callbackUrl: "/" });
  };

  const handleDev = async () => {
    if (!devEmail.trim()) return;
    setLoading(true);
    setError(null);
    const result = await signIn("dev-credentials", { email: devEmail, redirect: false });
    if (result?.error) {
      setError("Sign-in failed. Check your email.");
      setLoading(false);
    } else {
      router.replace("/");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ink-950">
        <p className="font-mono text-parchment-700 text-xs tracking-widest animate-pulse">loading…</p>
      </div>
    );
  }

  const isDev     = process.env.NODE_ENV === "development";
  // Google provider availability isn't exposed client-side; we show the button
  // and let it fail gracefully if not configured yet

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-ink-950 px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Wordmark */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <BrandMark size={52} stroke={7} dotR={7} />
          </div>
          <h1 className="font-display text-4xl text-parchment-200">Progress</h1>
          <p className="font-mono text-xs text-parchment-700 tracking-[0.2em] uppercase">
            your progress, mapped how you want it
          </p>
        </div>

        <div className="space-y-3">
          {/* Google sign-in */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-ink-800 border border-ink-600
                       rounded-xl px-4 py-3.5 text-sm font-mono text-parchment-300
                       hover:border-parchment-600 hover:text-parchment-200
                       transition-all duration-150 active:scale-[0.98] disabled:opacity-50
                       min-h-[52px]"
          >
            {/* Google "G" glyph — inline SVG, no external library */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Dev-only login */}
          {isDev && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-ink-700" />
                <span className="font-mono text-[9px] text-parchment-800 uppercase tracking-widest">dev only</span>
                <div className="flex-1 border-t border-ink-700" />
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  className="input flex-1 text-sm"
                  placeholder="any@email.com"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleDev()}
                />
                <button
                  onClick={handleDev}
                  disabled={!devEmail.trim() || loading}
                  className="btn-primary px-4"
                >
                  Go
                </button>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <p className="font-mono text-xs text-priority-high text-center">{error}</p>
          )}

          {/* Legal consent */}
          <p className="font-mono text-[10px] text-parchment-700 text-center leading-5 px-2">
            By continuing you agree to our{" "}
            <Link href="/terms" className="text-parchment-500 hover:text-parchment-300 underline">Terms</Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-parchment-500 hover:text-parchment-300 underline">Privacy Policy</Link>.
          </p>
        </div>

        {/* Try-mode note */}
        <div className="text-center">
          <button
            onClick={() => router.replace("/")}
            className="font-mono text-[10px] text-parchment-700 hover:text-parchment-500
                       tracking-widest uppercase transition-colors"
          >
            try without signing in →
          </button>
        </div>
      </div>
    </div>
  );
}
