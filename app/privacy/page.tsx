import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · Progress",
  description: "What Progress collects, why, and your choices.",
};

export default function PrivacyPage() {
  return (
    <main className="flex-1 px-5 pt-safe pt-8 pb-16 animate-fade-in">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <Link href="/" className="font-mono text-[11px] text-parchment-700 hover:text-parchment-400 transition-colors">
            ← Back
          </Link>
          <h1 className="font-display italic text-3xl text-parchment-100 leading-tight">Privacy Policy</h1>
          <p className="font-mono text-[11px] text-parchment-700">Last updated: 2026-07-07</p>
        </header>

        <p className="font-mono text-sm text-parchment-300 leading-7">
          Progress (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a journaling app operated by Aarrav, based in
          Ontario, Canada. This policy explains what we collect, why, and your choices.
        </p>

        <Section title="What we collect">
          <ul className="space-y-2 list-disc pl-5">
            <li><strong className="text-parchment-200">Account info:</strong> when you sign in with Google, we receive your name, email, and profile image.</li>
            <li><strong className="text-parchment-200">Your content:</strong> your journal entries and the tasks, goals, reminders, and moods derived from them. Audio you record is processed to produce a transcript and is <strong className="text-parchment-200">not stored</strong> — only the transcript is saved.</li>
            <li><strong className="text-parchment-200">Preferences:</strong> app settings you choose (theme, layout, reminder time, etc.).</li>
            <li><strong className="text-parchment-200">Notification data:</strong> if you enable push notifications, we store the subscription identifier your browser provides so we can deliver them.</li>
            <li><strong className="text-parchment-200">Basic technical data:</strong> standard logs and performance metrics needed to run the service.</li>
          </ul>
        </Section>

        <Section title="How we use it">
          <p>
            To provide the app: store and display your entries, transcribe your recordings, and generate
            structured insights (tasks, goals, reminders, mood) from what you write or say.
          </p>
          <p className="mt-3">
            <strong className="text-parchment-200">Support resources:</strong> as part of the same analysis,
            the app checks whether an entry appears to describe a moment of crisis so it can show links to
            free support resources. This assessment is transient — it is{" "}
            <strong className="text-parchment-200">never stored</strong> in our database or on your device,
            never attached to your entry or profile, and never used for analytics.
          </p>
        </Section>

        <Section title="Third parties who process your data">
          <ul className="space-y-2 list-disc pl-5">
            <li><strong className="text-parchment-200">Groq</strong> — processes your recorded audio to produce a transcript.</li>
            <li><strong className="text-parchment-200">Google (Gemini API)</strong> — processes your entry text to extract structure and insights. Google also provides sign-in (OAuth).</li>
            <li><strong className="text-parchment-200">Neon</strong> — hosts our database. <strong className="text-parchment-200">Vercel</strong> — hosts the application.</li>
          </ul>
          <p className="mt-3">We do not sell your data or use it for advertising.</p>
        </Section>

        <Section title="Retention">
          <p>
            We keep your data until you delete it. Deleting your account permanently removes your entries,
            tasks, goals, and reminders from our database. Some data (like typing suggestions learned from
            your entries, or try-mode entries made before signing in) lives only in your browser&apos;s local
            storage — deleting your account also clears it on that device.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can <strong className="text-parchment-200">export</strong> all your data or{" "}
            <strong className="text-parchment-200">permanently delete your account</strong> at any time from
            Settings. Depending on your location (e.g. GDPR/PIPEDA) you may have additional rights of access,
            correction, and erasure — contact us to exercise them.
          </p>
        </Section>

        <Section title="Security">
          <p>
            We use industry-standard measures (encrypted transport, access controls). No system is perfectly
            secure; we cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Progress is not intended for users under 13. We do not knowingly collect data from children.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update this policy; we&apos;ll revise the &ldquo;last updated&rdquo; date and, for material
            changes, notify you in-app.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            <a href="mailto:aarravbala@gmail.com" className="text-gold hover:underline">aarravbala@gmail.com</a>
          </p>
        </Section>

        <p className="font-mono text-[11px] text-parchment-700 pt-4">
          See also our <Link href="/terms" className="text-gold hover:underline">Terms of Service</Link>.
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display italic text-xl text-parchment-200">{title}</h2>
      <div className="font-mono text-sm text-parchment-400 leading-7">{children}</div>
    </section>
  );
}
