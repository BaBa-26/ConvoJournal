"use client";

import { useEffect } from "react";

// Global error boundary: catches failures in the root layout itself. Because it replaces
// the entire document (root layout included), it renders its own <html>/<body> and can't
// rely on globals.css utility classes — styles are inlined to stay on-brand regardless.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#0f0e0b",
          color: "#e9dcc3",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        {/* Progress mark: gold ring with a filled centre dot */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            border: "3px solid #c8a878",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: 4, background: "#c8a878" }} />
        </div>

        <div style={{ maxWidth: 320 }}>
          <h2 style={{ fontStyle: "italic", fontSize: "1.5rem", color: "#f0e4cc", margin: "0 0 0.5rem" }}>
            Something broke
          </h2>
          <p style={{ fontSize: "0.75rem", lineHeight: 1.6, color: "#8a7f6b", margin: 0 }}>
            An unexpected error occurred. You can try again or reload the page.
          </p>
        </div>

        <button
          onClick={reset}
          style={{
            cursor: "pointer",
            padding: "0.65rem 1.5rem",
            borderRadius: "0.75rem",
            border: "none",
            background: "#c8a878",
            color: "#1a1815",
            fontSize: "0.8rem",
            fontFamily: "inherit",
            letterSpacing: "0.02em",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
