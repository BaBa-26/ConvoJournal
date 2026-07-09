import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service · Progress",
  description: "The terms for using Progress.",
};

export default function TermsPage() {
  return (
    <main className="flex-1 px-5 pt-safe pt-8 pb-16 animate-fade-in">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <Link href="/" className="font-mono text-[11px] text-parchment-700 hover:text-parchment-400 transition-colors">
            ← Back
          </Link>
          <h1 className="font-display italic text-3xl text-parchment-100 leading-tight">Terms of Service</h1>
          <p className="font-mono text-[11px] text-parchment-700">Last updated: 2026-07-07</p>
        </header>

        <Section title="1. Acceptance">
          <p>By using Progress you agree to these Terms. If you don&apos;t agree, don&apos;t use the app.</p>
        </Section>

        <Section title="2. The service">
          <p>
            Progress is a voice/text journaling app that transcribes recordings and generates tasks, goals,
            reminders, and mood insights. It is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
            basis, and is currently an early-stage product.
          </p>
        </Section>

        <Section title="3. Accounts">
          <p>You&apos;re responsible for activity under your account and for keeping access to your sign-in secure.</p>
        </Section>

        <Section title="4. Your content">
          <p>
            You own your journal entries and content. You grant us only the limited permission needed to store,
            process, and display that content to you and to operate the features described (including sending it
            to our processors listed in the <Link href="/privacy" className="text-gold hover:underline">Privacy Policy</Link>).
          </p>
        </Section>

        <Section title="5. AI-generated output">
          <p>
            Transcriptions and generated insights are produced by automated models and may be inaccurate or
            incomplete. Don&apos;t rely on them for medical, legal, financial, or other professional decisions.
          </p>
        </Section>

        <Section title="5a. Not a medical or emergency service">
          <p>
            Progress is not a medical device, therapy, or crisis service. When an entry appears to describe a
            difficult moment, the app may show links to third-party support resources (such as helplines).
            These are informational only, may not fire or apply in every situation, and are not a substitute
            for professional care. If you are in immediate danger, contact your local emergency number.
            Crisis-related assessments are not stored — see the{" "}
            <Link href="/privacy" className="text-gold hover:underline">Privacy Policy</Link>.
          </p>
        </Section>

        <Section title="6. Acceptable use">
          <p>
            Don&apos;t misuse the service, attempt to break or overload it, access others&apos; data, or use it
            for unlawful purposes.
          </p>
        </Section>

        <Section title="7. No warranty">
          <p>
            To the maximum extent permitted by law, the service is provided without warranties of any kind.
          </p>
        </Section>

        <Section title="8. Limitation of liability">
          <p>
            To the maximum extent permitted by law, we are not liable for indirect, incidental, or consequential
            damages, or for loss of data arising from use of the service.
          </p>
        </Section>

        <Section title="9. Termination">
          <p>
            You may delete your account at any time. We may suspend or terminate access for violations of these Terms.
          </p>
        </Section>

        <Section title="10. Changes">
          <p>We may update these Terms; continued use after changes means you accept them.</p>
        </Section>

        <Section title="11. Governing law">
          <p>
            These Terms are governed by the laws of the Province of Ontario and the applicable laws of Canada.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            <a href="mailto:aarravbala@gmail.com" className="text-gold hover:underline">aarravbala@gmail.com</a>
          </p>
        </Section>

        <p className="font-mono text-[11px] text-parchment-700 pt-4">
          See also our <Link href="/privacy" className="text-gold hover:underline">Privacy Policy</Link>.
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
