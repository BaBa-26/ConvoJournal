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
        // Charcoal backgrounds
        ink: {
          950: "#0f0e0b",
          900: "#1a1815",
          800: "#252220",
          700: "#302d29",
          600: "#3d3a35",
        },
        // Parchment text
        parchment: {
          DEFAULT: "#e8d5b0",
          100: "#f0e4cc",
          200: "#e8d5b0",
          300: "#d4c09a",
          400: "#c8b89a",
          500: "#b8a88a",
          600: "#8a7a68",
          700: "#6a5a4a",
          800: "#4a3c2e",
        },
        // Amber gold accent
        gold: {
          DEFAULT: "#c8a878",
          light: "#d8bc98",
          dark: "#a88858",
        },
        // Priority colors
        priority: {
          high: "#c87a6a",
          medium: "#c8a860",
          low: "#7a9a7a",
        },
      },
      fontFamily: {
        display: ["var(--font-playfair)", "Georgia", "serif"],
        mono: ["var(--font-dm-mono)", "ui-monospace", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out forwards",
        "slide-up": "slideUp 0.35s ease-out forwards",
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
        "gold-glow": "0 0 24px rgba(200, 168, 120, 0.25)",
        "gold-glow-lg": "0 0 40px rgba(200, 168, 120, 0.35)",
      },
    },
  },
  plugins: [],
};
