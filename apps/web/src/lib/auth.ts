import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { accounts, users } from "@flipcast/server-db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { env } from "./env";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      isAdmin?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isAdmin?: boolean;
  }
}

const googleEnabled = Boolean(
  env.googleClientId && env.googleClientSecret,
);

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
  }) as NextAuthOptions["adapter"],
  session: { strategy: "jwt" },
  secret: env.authSecret,
  pages: { signIn: "/login" },
  providers: [
    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: env.googleClientId,
            clientSecret: env.googleClientSecret,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Email + password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        const row = await db.query.users.findFirst({
          where: eq(users.email, email),
        });
        if (!row || !row.passwordHash) return null;
        const ok = await bcrypt.compare(password, row.passwordHash);
        if (!ok) return null;
        // Credentials accounts must verify their email before they can
        // sign in. Google OAuth is exempt (Google already verified).
        if (!row.emailVerified) return null;
        return {
          id: row.id,
          email: row.email,
          name: row.name ?? null,
          image: row.image ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = (user as { id: string }).id;
      // Refresh isAdmin from DB each time the JWT is minted. Cheap (id-keyed
      // lookup) and means admin toggles take effect on next request.
      if (token.sub) {
        const rows = await db
          .select({ isAdmin: users.isAdmin })
          .from(users)
          .where(eq(users.id, token.sub))
          .limit(1);
        token.isAdmin = rows[0]?.isAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      if (session.user) session.user.isAdmin = Boolean(token.isAdmin);
      return session;
    },
  },
};

export function getSession() {
  return getServerSession(authOptions);
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.isAdmin) return null;
  return session;
}
