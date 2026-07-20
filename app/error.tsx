"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

// Route-level error boundary: catches render/runtime errors in any segment and offers
// a recovery path instead of a blank crash.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen gap-6 px-8 text-center animate-fade-in">
      <p className="font-mono text-3xl text-parchment-800">◈</p>
      <div className="space-y-2">
        <h2 className="font-display italic text-2xl text-parchment-200">Something broke</h2>
        <p className="font-mono text-xs text-parchment-700 leading-6">
          An unexpected error occurred.<br />You can try again or head back home.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="btn-primary px-6">Try again</button>
        <Link href="/" className="btn-ghost px-6">Go home</Link>
      </div>
    </div>
  );
}
