import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET);

// NextAuth's Credentials provider (dev-only) CANNOT create database sessions — the adapter
// only persists sessions for OAuth/email logins. So in development we use JWT sessions (which
// the credentials provider supports); production keeps database sessions for Google OAuth,
// exactly as before. Gated on NODE_ENV so prod is untouched.
const useJwtSessions = process.env.NODE_ENV === "development";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    // Google OAuth — active only when credentials are set in .env
    ...(googleConfigured
      ? [GoogleProvider({
          clientId:     process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        })]
      : []),

    // Dev-only credentials provider — allows testing auth before Google is wired up
    ...(process.env.NODE_ENV === "development"
      ? [CredentialsProvider({
          id:   "dev-credentials",
          name: "Dev Login",
          credentials: {
            email: { label: "Email", type: "email", placeholder: "you@example.com" },
          },
          async authorize(credentials) {
            if (!credentials?.email) return null;
            // Upsert a user record for the dev email
            return prisma.user.upsert({
              where:  { email: credentials.email },
              update: {},
              create: {
                email: credentials.email,
                name:  credentials.email.split("@")[0],
              },
            });
          },
        })]
      : []),
  ],

  session: { strategy: useJwtSessions ? "jwt" : "database" },

  callbacks: {
    // JWT mode (dev): stash the user's id/onboarded/displayName into the token on sign-in.
    // On a session refresh (update() — e.g. after onboarding) re-read the changed fields from
    // the DB so onboarded=true propagates and the onboarding gate doesn't loop.
    async jwt({ token, user, trigger }) {
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = user as any;
        token.uid         = u.id;
        token.onboarded   = u.onboarded   ?? false;
        token.displayName = u.displayName ?? null;
      } else if (trigger === "update" && token.uid) {
        const fresh = await prisma.user.findUnique({
          where:  { id: token.uid as string },
          select: { onboarded: true, displayName: true },
        });
        if (fresh) {
          token.onboarded   = fresh.onboarded;
          token.displayName = fresh.displayName ?? null;
        }
      }
      return token;
    },
    // Works for both strategies: database mode passes `user`, JWT mode passes `token`.
    session({ session, user, token }) {
      if (!session.user) return session;
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = user as any;
        session.user.id          = u.id;
        session.user.onboarded   = u.onboarded   ?? false;
        session.user.displayName = u.displayName ?? null;
      } else if (token) {
        session.user.id          = (token.uid as string) ?? (token.sub as string);
        session.user.onboarded   = (token.onboarded as boolean) ?? false;
        session.user.displayName = (token.displayName as string | null) ?? null;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error:  "/login",
  },
};

// ─── Server-side auth helpers ─────────────────────────────────────────────────

export async function getAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return { userId: session.user.id, user: session.user };
}

/** Use inside API route handlers — returns 401 early if not authenticated */
export async function requireAuth(): Promise<
  { userId: string; user: NonNullable<typeof authOptions>["session"] } | NextResponse
> {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return auth as { userId: string; user: NonNullable<typeof authOptions>["session"] };
}
