"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

const EXEMPT = ["/onboarding", "/login", "/landing"];

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (EXEMPT.some((p) => pathname.startsWith(p))) return;
    if (pathname.startsWith("/api")) return;
    if (session.user.onboarded === false) {
      router.replace("/onboarding");
    }
  }, [session, status, pathname, router]);

  return <>{children}</>;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <OnboardingGuard>{children}</OnboardingGuard>
    </SessionProvider>
  );
}
