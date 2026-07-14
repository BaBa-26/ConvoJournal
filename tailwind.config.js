/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // shadcn-compatible tokens (CSS variable driven, opacity-modifier safe)
        border: "hsl(var(--border) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        // Charcoal backgrounds — CSS-var driven so they flip in light mode (see globals.css)
        ink: {
          950: "rgb(var(--ink-950) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
        },
        // Parchment text — CSS-var driven so it flips (→ dark text) in light mode
        parchment: {
          DEFAULT: "rgb(var(--parchment-200) / <alpha-value>)",
          100: "rgb(var(--parchment-100) / <alpha-value>)",
          200: "rgb(var(--parchment-200) / <alpha-value>)",
          300: "rgb(var(--parchment-300) / <alpha-value>)",
          400: "rgb(var(--parchment-400) / <alpha-value>)",
          500: "rgb(var(--parchment-500) / <alpha-value>)",
          600: "rgb(var(--parchment-600) / <alpha-value>)",
          700: "rgb(var(--parchment-700) / <alpha-value>)",
          800: "rgb(var(--parchment-800) / <alpha-value>)",
        },
        // Fixed dark text for placing ON the accent/gold (never flips — keeps contrast in light mode)
        onaccent: "rgb(var(--on-accent) / <alpha-value>)",
        // Amber gold accent — fixed brand chrome (does NOT follow user accent)
        gold: {
          DEFAULT: "#c8a878",
          light: "#d8bc98",
          dark: "#a88858",
        },
        // User-customizable accent — CSS-var driven (RGB channels, so `/opacity` modifiers work).
        // Defaults to gold via globals.css :root so the look is unchanged until a user picks an accent.
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          light: "rgb(var(--accent-light) / <alpha-value>)",
          dark: "rgb(var(--accent-dark) / <alpha-value>)",
          // Text-safe accent: base in dark mode, deepened in light mode. Use for
          // accent-colored TEXT on surfaces (pills, links, counts) — never fills.
          ink: "rgb(var(--accent-ink) / <alpha-value>)",
        },
        // Priority colors
        priority: {
          high: "#c87a6a",
          medium: "#c8a860",
          low: "#7a9a7a",
        },
        // Time tints — warm-family Yesterday/Today/Tomorrow section colors (design-system §1.4).
        // CSS-var driven so the label shade flips for light mode; the hue channels are shared.
        tint: {
          past: "rgb(var(--tint-past) / <alpha-value>)",
          "past-label": "rgb(var(--tint-past-label) / <alpha-value>)",
          now: "rgb(var(--tint-now) / <alpha-value>)",
          "now-label": "rgb(var(--tint-now-label) / <alpha-value>)",
          next: "rgb(var(--tint-next) / <alpha-value>)",
          "next-label": "rgb(var(--tint-next-label) / <alpha-value>)",
        },
      },
      // Type roles (design-system §2.1). voice-*/numeral multiply by the user's
      // --type-scale preference so the whole "spoken" layer honors it.
      fontSize: {
        label: ["10px", { lineHeight: "1.4", letterSpacing: "0.2em" }],
        meta: ["11px", { lineHeight: "1.5" }],
        body: ["13px", { lineHeight: "1.6" }],
        "body-lg": ["15px", { lineHeight: "1.7" }],
        "voice-sm": ["calc(1.0625rem * var(--type-scale))", { lineHeight: "1.5" }],
        voice: ["calc(1.375rem * var(--type-scale))", { lineHeight: "1.35" }],
        "voice-lg": ["calc(1.75rem * var(--type-scale))", { lineHeight: "1.25" }],
        "voice-xl": ["calc(2.75rem * var(--type-scale))", { lineHeight: "1.1" }],
        numeral: ["calc(2.125rem * var(--type-scale))", { lineHeight: "1.1" }],
      },
      transitionDuration: {
        quick: "120ms",
        gentle: "240ms",
        calm: "400ms",
      },
      transitionTimingFunction: {
        calm: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      fontFamily: {
        display: ["var(--font-playfair)", "Georgia", "serif"],
        mono: ["var(--font-dm-mono)", "ui-monospace", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out forwards",
        "slide-up": "slideUp 0.35s ease-out forwards",
        // Payoff stagger (design-system §4/§7.4) — "both" keeps delayed items hidden pre-start
        rise: "rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        // Idle record halo — breathing pace, replaces the 2s notification-style pulse-ring
        breathe: "breathe 3.6s ease-in-out infinite",
        "blink": "blink 1s step-end infinite",
        "wave-1": "wave 1.1s ease-in-out infinite",
        "wave-2": "wave 0.9s ease-in-out infinite 0.1s",
        "wave-3": "wave 1.3s ease-in-out infinite 0.2s",
        "wave-4": "wave 0.8s ease-in-out infinite 0.05s",
        "wave-5": "wave 1.2s ease-in-out infinite 0.3s",
        "wave-6": "wave 1.0s ease-in-out infinite 0.15s",
        "wave-7": "wave 1.4s ease-in-out infinite 0.25s",
        "wave-8": "wave 0.95s ease-in-out infinite 0.35s",
        "spin-slow": "spin 2s linear infinite",
        "pulse-ring": "pulseRing 2s ease-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.45" },
          "50%": { transform: "scale(1.05)", opacity: "0.12" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        wave: {
          "0%, 100%": { transform: "scaleY(0.25)" },
          "50%": { transform: "scaleY(1)" },
        },
        pulseRing: {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
      },
      boxShadow: {
        // Accent-aware glow — follows the user's accent preset (record button only)
        glow: "0 0 24px rgb(var(--accent) / 0.25)",
        "glow-lg": "0 0 40px rgb(var(--accent) / 0.35)",
        // Overlay elevation — the only other shadows in the system
        sheet: "0 -8px 40px rgb(0 0 0 / 0.45)",
        modal: "0 12px 48px rgb(0 0 0 / 0.55)",
        // Legacy aliases (pre-design-system) — do not use in new code
        "gold-glow": "0 0 24px rgba(200, 168, 120, 0.25)",
        "gold-glow-lg": "0 0 40px rgba(200, 168, 120, 0.35)",
      },
    },
  },
  plugins: [],
};
