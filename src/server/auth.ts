import "server-only";
import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import ResendProvider from "next-auth/providers/resend";
import CredentialsProvider from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createId } from "@paralleldrive/cuid2";
import { db } from "./db";
import { users } from "../../db/schema";
import { env } from "@/lib/env";

/** True when running locally for development. Never true in Vercel/production. */
const IS_DEV = process.env.NODE_ENV !== "production";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: "student" | "specialist" | "admin";
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  // JWT strategy: lets Credentials provider work alongside magic-link.
  // Magic-link verification tokens are still stored in DB via the adapter.
  session: { strategy: "jwt" },
  secret: env.AUTH_SECRET,
  providers: [
    ResendProvider({
      from: "ESL Assessment <no-reply@clt-assessment.ca>",
      apiKey: env.RESEND_API_KEY,
    }),
    CredentialsProvider({
      name: "Staff Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) return null;
        if (user.role === "student") return null; // students use magic link only

        // passwordHash stored in the image column for MVP (avoids schema change)
        const hash = user.image;
        if (!hash) return null;

        const valid = await bcrypt.compare(password, hash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
    // ─── Dev-only bypass provider ─────────────────────────────────────────
    // Only active when NODE_ENV !== "production". Lets you sign in as an
    // auto-provisioned admin user with one click, no password required.
    // Returns null in production to make the provider a no-op even if it
    // somehow gets called.
    CredentialsProvider({
      id: "dev-bypass",
      name: "Dev Bypass",
      credentials: {},
      async authorize() {
        if (!IS_DEV) return null;

        const email = "dev@local";
        let [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) {
          const id = createId();
          await db.insert(users).values({
            id,
            email,
            name: "Dev Admin",
            role: "admin",
          });
          [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
        }

        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // On sign-in, embed role in token
        const dbUser = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, user.id!))
          .limit(1);
        token["role"] = dbUser[0]?.role ?? "student";
        token["userId"] = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token["userId"] as string;
      session.user.role = token["role"] as "student" | "specialist" | "admin";
      return session;
    },
  },
  pages: {
    signIn: "/en/login",
    error: "/en/login",
  },
});

/** Returns the current session or null. Safe to call from server components. */
export { auth as getServerSession };
