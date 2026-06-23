"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }))

  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg
        className="w-full h-full text-parchment-300"
        viewBox="0 0 696 316"
        fill="none"
      >
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.08 + path.id * 0.02}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{
              pathLength: 1,
              opacity: [0.3, 0.6, 0.3],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 20 + Math.random() * 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
        ))}
      </svg>
    </div>
  )
}

interface BackgroundPathsProps {
  title?: string
  subtitle?: string
  ctaLabel?: string
  ctaHref?: string
}

export function BackgroundPaths({
  title = "Background Paths",
  subtitle,
  ctaLabel = "Get started",
  ctaHref = "/",
}: BackgroundPathsProps) {
  const words = title.split(" ")

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-ink-950">
      <div className="absolute inset-0">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>

      <div className="relative z-10 container mx-auto px-4 md:px-6 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold mb-6 tracking-tighter">
            {words.map((word, wordIndex) => (
              <span key={wordIndex} className="inline-block mr-4 last:mr-0">
                {word.split("").map((letter, letterIndex) => (
                  <motion.span
                    key={`${wordIndex}-${letterIndex}`}
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      delay: wordIndex * 0.1 + letterIndex * 0.03,
                      type: "spring",
                      stiffness: 150,
                      damping: 25,
                    }}
                    className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-parchment-200 to-parchment-400/80"
                  >
                    {letter}
                  </motion.span>
                ))}
              </span>
            ))}
          </h1>

          {subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="text-parchment-600 text-lg md:text-xl mb-10 max-w-xl mx-auto leading-relaxed font-mono"
            >
              {subtitle}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: subtitle ? 1.1 : 0.9, duration: 0.5 }}
            className="inline-block group relative border border-gold/20 bg-gold/5 p-px rounded-2xl backdrop-blur-lg overflow-hidden shadow-lg hover:shadow-gold-glow transition-shadow duration-300"
          >
            <Button
              variant="ghost"
              className="rounded-[1.15rem] px-8 py-6 text-lg font-mono tracking-wide backdrop-blur-md bg-ink-900/80 hover:bg-ink-800/90 text-parchment-200 hover:text-parchment-100 transition-all duration-300 group-hover:-translate-y-0.5 border border-gold/30 hover:border-gold/50"
              asChild
            >
              <Link href={ctaHref}>
                <span className="opacity-90 group-hover:opacity-100 transition-opacity">
                  {ctaLabel}
                </span>
                <span className="ml-3 text-gold/70 group-hover:text-gold group-hover:translate-x-1.5 transition-all duration-300">
                  →
                </span>
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
