import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TodayScreen from "@/components/TodayScreen";

// The home dashboard is auth-only. Signed-out visitors are sent to the marketing
// landing (our real front door) — deciding server-side avoids a flash of the
// dashboard before the redirect. Try-mode stays reachable from the landing's CTAs
// (Start for free → /journal).
//
// First-time users land here after signing in from *any* entry point (Get Started
// or a direct "Sign in"), so we also enforce onboarding server-side — guaranteed even
// if client JS is slow/blocked, and with no flash of the dashboard. The client-side
// OnboardingGuard (AuthProvider) still covers deep-links to other routes.
export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/landing");
  // DB-authoritative onboarding gate: the session's `onboarded` can be a stale JWT (dev) right
  // after onboarding, so when it claims not-onboarded we confirm against the DB (source of
  // truth) before redirecting. This prevents an onboarding redirect loop.
  if (session.user?.onboarded === false) {
    const fresh = await prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { onboarded: true },
    });
    if (!fresh?.onboarded) redirect("/onboarding");
  }
  return <TodayScreen />;
}
