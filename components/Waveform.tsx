"use client";

import { useEffect, useRef, useState } from "react";

// Live waveform (design-system §6.6) — bars render a scrolling history of the REAL
// input level (levelRef is written by useRecorder's AnalyserNode loop), so the app
// visibly listens instead of performing a fake animation. DOM styles are mutated in
// a rAF loop (no React re-renders at frame rate).
//
// Reduced motion: a discrete 8-dot level meter (status feedback, no continuous sway).
// Native port: feed levelRef from AVAudioRecorder / AudioRecord peaks — same contract.

const BAR_COUNT = 24;
const SLICE_MS = 90; // one bar ≈ 90ms of speech

export default function Waveform({ levelRef }: { levelRef: React.MutableRefObject<number> }) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const historyRef = useRef<number[]>(Array(BAR_COUNT).fill(0));
  const [reducedMotion, setReducedMotion] = useState(false);
  const [dotLevel, setDotLevel] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Continuous bars — scrolling history, newest at the right.
  useEffect(() => {
    if (reducedMotion) return;
    let raf: number;
    let lastSlice = performance.now();
    let slicePeak = 0;

    const tick = (now: number) => {
      slicePeak = Math.max(slicePeak, levelRef.current);
      if (now - lastSlice >= SLICE_MS) {
        historyRef.current.push(slicePeak);
        historyRef.current.shift();
        slicePeak = 0;
        lastSlice = now;
        const h = historyRef.current;
        for (let i = 0; i < BAR_COUNT; i++) {
          const el = barsRef.current[i];
          if (el) el.style.transform = `scaleY(${0.12 + h[i] * 0.88})`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levelRef, reducedMotion]);

  // Reduced-motion dot meter — coarse discrete updates only.
  useEffect(() => {
    if (!reducedMotion) return;
    const id = setInterval(() => {
      setDotLevel(Math.round(levelRef.current * 8));
    }, 400);
    return () => clearInterval(id);
  }, [levelRef, reducedMotion]);

  if (reducedMotion) {
    return (
      <div
        className="flex items-center justify-center gap-2 h-14"
        role="status"
        aria-label="Recording — microphone is live"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={i}
            className={`w-2 h-2 rounded-full transition-opacity duration-quick ${
              i < dotLevel ? "bg-accent opacity-90" : "bg-accent opacity-20"
            }`}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center gap-[3px] h-14"
      role="status"
      aria-label="Recording — microphone is live"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
          className="w-[3px] h-12 rounded-full bg-accent origin-center
                     transition-transform duration-gentle ease-calm"
          style={{ transform: "scaleY(0.12)", opacity: 0.55 + (i / BAR_COUNT) * 0.45 }}
        />
      ))}
    </div>
  );
}
