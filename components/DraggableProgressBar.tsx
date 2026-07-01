"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useMotionValue } from "framer-motion";

// A progress track the user can drag (or tap) to set a 0–100 value.
// - `onChangeLive` fires continuously during drag (update local state only).
// - `onCommit` fires once on drag-end / tap (persist to the API).
export default function DraggableProgressBar({
  progress,
  onChangeLive,
  onCommit,
  disabled = false,
}: {
  progress: number;
  onChangeLive: (p: number) => void;
  onCommit: (p: number) => void;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Measure the track (and re-measure on resize).
  useEffect(() => {
    const measure = () => setTrackWidth(trackRef.current?.offsetWidth ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Keep the handle synced to `progress` whenever we're not actively dragging.
  useEffect(() => {
    if (!dragging && trackWidth > 0) x.set((progress / 100) * trackWidth);
  }, [progress, trackWidth, dragging, x]);

  const pctFromX = (rawX: number) => {
    if (trackWidth <= 0) return progress;
    const clamped = Math.min(Math.max(rawX, 0), trackWidth);
    return Math.round((clamped / trackWidth) * 100);
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    if (disabled || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const p = pctFromX(e.clientX - rect.left);
    onChangeLive(p);
    onCommit(p);
  };

  return (
    <div className="flex items-center gap-2.5 mt-2 select-none">
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className={`relative flex-1 h-2 rounded-full bg-ink-800 ${disabled ? "" : "cursor-pointer"}`}
      >
        {/* fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent pointer-events-none"
          style={{ width: `${progress}%` }}
        />
        {/* handle */}
        {!disabled && trackWidth > 0 && (
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: trackWidth }}
            dragElastic={0}
            dragMomentum={false}
            style={{ x }}
            onPointerDown={(e) => e.stopPropagation()}
            onDragStart={() => setDragging(true)}
            onDrag={() => onChangeLive(pctFromX(x.get()))}
            onDragEnd={() => {
              const p = pctFromX(x.get());
              setDragging(false);
              onCommit(p);
            }}
            className="absolute top-1/2 -mt-2 -ml-2 w-4 h-4 rounded-full bg-accent border-2 border-ink-950 cursor-grab active:cursor-grabbing touch-none"
          />
        )}
      </div>
      <span className="font-mono text-[10px] text-parchment-700 w-9 text-right tabular-nums">{progress}%</span>
    </div>
  );
}
