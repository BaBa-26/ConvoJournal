"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEMO_PROFILE, resetDemoState } from "@/lib/demoData";

export default function SettingsScreen() {
  const { data: session } = useSession();
  const router = useRouter();
  const [resetting, setResetting] = useState(false);

  const handleReset = () => {
    setResetting(true);
    resetDemoState();
    router.refresh();
    setTimeout(() => setResetting(false), 300);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden animate-fade-in">
      <header className="px-5 pt-safe pt-5 pb-4 flex-shrink-0">
        <p className="font-mono text-[10px] text-parchment-700 uppercase tracking-[0.2em]">
          profile / settings
        </p>
        <h1 className="font-display italic text-2xl text-parchment-100 leading-tight mt-1">
          keep the app tuned
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        <section className="card space-y-3">
          <p className="label">Account</p>
          <div className="space-y-1">
            <p className="font-display italic text-lg text-parchment-200">
              {session?.user?.name ?? DEMO_PROFILE.name}
            </p>
            <p className="font-mono text-xs text-parchment-700">
              {session?.user?.email ?? DEMO_PROFILE.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {session ? (
              <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-ghost">
                Sign out
              </button>
            ) : (
              <button onClick={() => signIn()} className="btn-primary">
                Sign in
              </button>
            )}
            <Link href="/login" className="btn-ghost">
              Onboarding
            </Link>
          </div>
        </section>

        <section className="card space-y-3">
          <p className="label">Testing</p>
          <p className="font-mono text-sm text-parchment-300 leading-6">
            Demo mode keeps preloaded journal, task, and reminder data in local storage so you can test the app without auth.
          </p>
          <button onClick={handleReset} disabled={resetting} className="btn-primary w-full">
            {resetting ? "Resetting…" : "Reset demo data"}
          </button>
        </section>

        <section className="card space-y-2">
          <p className="label">Shortcuts</p>
          <div className="flex flex-col gap-2">
            <Link href="/" className="btn-ghost justify-start">Today</Link>
            <Link href="/journal" className="btn-ghost justify-start">Journal</Link>
            <Link href="/schedule" className="btn-ghost justify-start">Calendar</Link>
            <Link href="/tasks" className="btn-ghost justify-start">Goals</Link>
          </div>
        </section>
      </div>
    </div>
  );
}