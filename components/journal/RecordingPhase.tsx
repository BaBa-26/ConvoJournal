"use client";

import Waveform from "@/components/Waveform";
import RecordButton from "@/components/ui/RecordButton";

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

// Recording (design-system §6.6) — the timer speaks in Voice; the waveform and the
// button's halo track the REAL input level, so the app visibly listens.

export default function RecordingPhase({
  elapsed,
  levelRef,
  onStop,
  onCancel,
}: {
  elapsed: number;
  levelRef: React.MutableRefObject<number>;
  onStop: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-8 animate-fade-in pb-nav">
      {/* Elapsed — Voice numerals */}
      <p
        role="timer"
        aria-label={`Recording, ${formatElapsed(elapsed)} elapsed`}
        className="font-display text-voice-xl text-parchment-300 tracking-tight tabular-nums"
      >
        {formatElapsed(elapsed)}
      </p>

      <div className="w-full px-4">
        <Waveform levelRef={levelRef} />
      </div>

      <div className="flex flex-col items-center gap-2">
        <RecordButton state="recording" onPress={onStop} size="compact" levelRef={levelRef} />
        <span className="font-mono text-label uppercase text-parchment-700">tap to stop</span>
      </div>

      <p className="font-display italic text-body-lg text-parchment-700">
        take your minute — we&apos;ll sort it after.
      </p>

      <button onClick={onCancel} className="btn-quiet text-parchment-700 hover:text-parchment-500">
        ✕ discard take
      </button>
    </div>
  );
}
