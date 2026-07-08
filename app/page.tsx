import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import TodayScreen from "@/components/TodayScreen";

// The home dashboard is auth-only. Signed-out visitors are sent to the marketing
// landing (our real front door) — deciding server-side avoids a flash of the
// dashboard before the redirect. Try-mode stays reachable from the landing's CTAs
// (Start for free → /journal).
export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/landing");
  return <TodayScreen />;
}
