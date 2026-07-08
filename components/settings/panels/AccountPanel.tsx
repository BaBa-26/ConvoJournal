"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";
import { usePreferences } from "@/components/PreferencesProvider";
import { DEMO_PROFILE } from "@/lib/demoData";

function initialOf(name: string): string {
  const t = name.trim();
  return t ? t[0].toUpperCase() : "·";
}

// Who you are: avatar, display name, and sign-in/out. Name changes persist immediately.
export default function AccountPanel({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const { prefs, patchPrefs } = usePreferences();
  const [nameDraft, setNameDraft] = useState<string | null>(null);

  const name = prefs.displayName ?? session?.user?.name ?? DEMO_PROFILE.name;
  const email = session?.user?.email ?? DEMO_PROFILE.email;
  const image = session?.user?.image ?? null;
  const nameValue = nameDraft ?? prefs.displayName ?? session?.user?.name ?? "";

  return (
    <div className="space-y-4">
      {/* Identity */}
      <section className="card space-y-4">
        <div className="flex items-center gap-4">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
          ) : (
            <span className="w-16 h-16 rounded-full bg-accent/15 border border-accent/30 text-accent
                             flex items-center justify-center font-display italic text-2xl flex-shrink-0">
              {initialOf(name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="font-display italic text-xl text-parchment-100 truncate">{name}</p>
            <p className="font-mono text-xs text-parchment-700 truncate">{email}</p>
            <p className="font-mono text-[10px] text-parchment-800 mt-1 uppercase tracking-widest">
              {session ? "signed in" : "try mode · not signed in"}
            </p>
          </div>
        </div>

        {/* Display name */}
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-parchment-600">Display name</label>
          <input
            className="input"
            value={nameValue}
            placeholder="Your name"
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              const v = (nameDraft ?? "").trim();
              if (nameDraft !== null && v) patchPrefs({ displayName: v });
              setNameDraft(null);
            }}
          />
          <p className="font-mono text-[11px] text-parchment-700">
            Shown across the app in place of your account name.
          </p>
        </div>
      </section>

      {/* Account actions */}
      <section className="card space-y-3">
        <p className="label">Account</p>
        <div className="flex flex-wrap gap-2">
          {session ? (
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-ghost">
              Sign out
            </button>
          ) : (
            <button onClick={() => signIn()} className="btn-primary">
              Sign in
            </button>
          )}
          <Link href="/login" onClick={onClose} className="btn-ghost">
            Onboarding
          </Link>
        </div>
      </section>
    </div>
  );
}
