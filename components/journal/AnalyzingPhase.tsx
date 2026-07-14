"use client";

import { useEffect, useRef, useState } from "react";

// Analysis interlude — the transcript types itself in while the parse runs.
// The parent owns the watchdog (§7.3); this component is purely presentational.

function useTypingReveal(text: string, active: boolean): string {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    if (!active || !text) {
      setDisplayed("");
      indexRef.current = 0;
      return;
    }
    indexRef.current = 0;
    setDisplayed("");
    // ~4s for 200 chars, clamped 8–30ms per tick; reveal 2 chars per tick.
    const speed = Math.max(8, Math.min(30, 4000 / text.length));
    const interval = setInterval(() => {
      indexRef.current += 2;
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, active]);

  return displayed;
}

export default function AnalyzingPhase({ transcript }: { transcript: string }) {
  const displayed = useTypingReveal(transcript, true);
  return (
    <div className="flex flex-col flex-1 gap-6 animate-fade-in pb-nav">
      {/* Status — announced politely to screen readers */}
      <div className="flex items-center gap-3 pt-2" role="status" aria-live="polite">
        <svg
          aria-hidden
          className="w-4 h-4 text-accent animate-spin-slow flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83
               M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
          />
        </svg>
        <span className="font-mono text-label uppercase text-accent-ink/90">
          putting your day in order…
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="card min-h-[200px]">
          <p className="label mb-3">Entry</p>
          <p className="font-mono text-body-lg text-parchment-300 whitespace-pre-wrap">
            {displayed}
            <span
              aria-hidden
              className="inline-block w-[2px] h-[15px] bg-accent ml-0.5 align-middle animate-blink"
            />
          </p>
        </div>
      </div>
    </div>
  );
}
