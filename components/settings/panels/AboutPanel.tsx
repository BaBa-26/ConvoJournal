"use client";

import Link from "next/link";

// Shortcuts, legal, support, and version — the quiet corner of settings.
export default function AboutPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-4">
      <section className="card space-y-2">
        <p className="label">Shortcuts</p>
        <div className="flex flex-col gap-2">
          <Link href="/" onClick={onClose} className="btn-ghost justify-start">Today</Link>
          <Link href="/journal" onClick={onClose} className="btn-ghost justify-start">Journal</Link>
          <Link href="/schedule" onClick={onClose} className="btn-ghost justify-start">Calendar</Link>
          <Link href="/tasks" onClick={onClose} className="btn-ghost justify-start">To-Do&apos;s</Link>
        </div>
      </section>

      <section className="card space-y-2">
        <p className="label">Legal &amp; support</p>
        <div className="flex flex-col gap-2">
          <Link href="/privacy" onClick={onClose} className="btn-ghost justify-start">Privacy Policy</Link>
          <Link href="/terms" onClick={onClose} className="btn-ghost justify-start">Terms of Service</Link>
          <a
            href="mailto:aarravbala@gmail.com?subject=Progress%20feedback"
            className="btn-ghost justify-start"
          >
            Send feedback
          </a>
        </div>
        <p className="font-mono text-[11px] text-parchment-700 pt-1">Progress · v1.0</p>
      </section>
    </div>
  );
}
