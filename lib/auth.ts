import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET);

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

  session: { strategy: "database" },

  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const u = user as any;
        session.user.onboarded   = u.onboarded   ?? false;
        session.user.displayName = u.displayName ?? null;
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
