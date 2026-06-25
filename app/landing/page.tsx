import Link from "next/link"
import { Mic, Brain, CalendarDays } from "lucide-react"
import { BackgroundPaths } from "@/components/ui/background-paths"
import { CTASection } from "@/components/ui/hero-dithering-card"

const features = [
  {
    icon: Mic,
    title: "Speak your day",
    description:
      "Hit record and talk. Progress transcribes everything — no typing, no friction, no context-switching.",
  },
  {
    icon: Brain,
    title: "Smart parsing",
    description:
      "Yesterday, Today, Tomorrow sections are extracted automatically. Tasks and reminders surface without you lifting a finger.",
  },
  {
    icon: CalendarDays,
    title: "Your timeline",
    description:
      "Every entry maps to a day. Scroll back through your week, spot patterns, and see how far you've come.",
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <BackgroundPaths
        title="Your progress mapped how you want it"
        subtitle="Speak your daily brain-dump. Progress turns it into tasks, reminders, and a timeline — automatically."
        ctaLabel="Get started free"
        ctaHref="/login"
      />

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="bg-ink-950 pb-28 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-parchment-700 mb-4">
            How it works
          </p>
          <h2 className="text-center font-display italic text-3xl md:text-4xl text-parchment-200 mb-16 tracking-tight">
            Your daily brain-dump, structured.
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="bg-ink-900 border border-ink-700 rounded-2xl p-6 flex flex-col gap-4 hover:border-ink-600 transition-colors duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-ink-800 border border-ink-700 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-gold" />
                </div>
                <h3 className="font-display text-lg text-parchment-200">{title}</h3>
                <p className="font-mono text-sm text-parchment-600 leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dithering CTA ────────────────────────────────────── */}
      <div className="bg-ink-950">
        <CTASection
          badge="Voice journaling"
          headline="Your progress,"
          subheadline="captured in seconds."
          description="Most journaling apps demand effort. Progress only needs your voice. Speak, done."
          ctaLabel="Start for free"
          ctaHref="/login"
        />
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="bg-ink-950 border-t border-ink-800 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-display italic text-xl text-parchment-200 tracking-tight">
            Progress
          </span>
          <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.15em] text-parchment-700">
            <Link href="/" className="hover:text-parchment-400 transition-colors">Today</Link>
            <Link href="/journal" className="hover:text-parchment-400 transition-colors">Journal</Link>
            <Link href="/schedule" className="hover:text-parchment-400 transition-colors">Calendar</Link>
            <Link href="/tasks" className="hover:text-parchment-400 transition-colors">Goals</Link>
          </div>
          <p className="font-mono text-[9px] text-parchment-800 uppercase tracking-widest">
            v1.0
          </p>
        </div>
      </footer>
    </div>
  )
}
