"use client";

// Animated waveform bars — pure CSS, no canvas needed
// Each bar uses scaleY to animate from 0.25→1→0.25 with staggered delays
// Heights and durations vary per bar to look organic

const BARS = [
  { h: 28, dur: "1.1s", delay: "0ms"   },
  { h: 40, dur: "0.8s", delay: "80ms"  },
  { h: 20, dur: "1.3s", delay: "160ms" },
  { h: 44, dur: "0.9s", delay: "40ms"  },
  { h: 36, dur: "1.2s", delay: "200ms" },
  { h: 48, dur: "0.75s", delay: "120ms" },
  { h: 24, dur: "1.4s", delay: "60ms"  },
  { h: 44, dur: "1.0s", delay: "180ms" },
  { h: 36, dur: "0.85s", delay: "100ms" },
  { h: 28, dur: "1.15s", delay: "140ms" },
  { h: 40, dur: "0.95s", delay: "20ms"  },
  { h: 20, dur: "1.25s", delay: "220ms" },
  { h: 44, dur: "0.8s", delay: "90ms"  },
  { h: 32, dur: "1.1s", delay: "170ms" },
  { h: 24, dur: "0.9s", delay: "50ms"  },
  { h: 40, dur: "1.3s", delay: "130ms" },
];

export default function Waveform() {
  return (
    <div
      className="flex items-center justify-center gap-[3px] h-14"
      aria-label="Recording in progress"
    >
      {BARS.map((bar, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-gold origin-center"
          style={{
            height: `${bar.h}px`,
            animation: `wave ${bar.dur} ease-in-out ${bar.delay} infinite`,
            // Slightly dim every other bar for depth
            opacity: i % 3 === 1 ? 0.6 : i % 3 === 2 ? 0.85 : 1,
          }}
        />
      ))}
    </div>
  );
}
