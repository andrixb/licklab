// Copyright (C) 2026 Andrea Baldo
// SPDX-License-Identifier: GPL-3.0-or-later — see LICENSE; full text:
// https://www.gnu.org/licenses/gpl-3.0.html (no warranty)

// worker/auth: Better Auth over D1 (OAuth only — no passwords, no hashing,
// safe for the 10ms free-tier CPU budget). Sessions live in D1; cookies are
// HttpOnly/Secure/SameSite; API is same-origin with Origin/Fetch-Metadata
// checks on state-changing routes.

import { betterAuth } from "better-auth";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { createD1Kysely } from "./d1-dialect.js";
import type { D1Like } from "./d1-dialect.js";

export interface AuthEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  OPEN_SIGNUP?: string; // "1" = open registration; default allowlist-only
  APP_ORIGIN?: string; // e.g. https://licklab.licklab.workers.dev
  BETTER_AUTH_SECRET?: string; // required in production (`wrangler secret put`)
}

export interface AuthTables {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  session: {
    id: string;
    expiresAt: Date;
    token: string;
    createdAt: Date;
    updatedAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    userId: string;
  };
  account: {
    id: string;
    accountId: string;
    providerId: string;
    userId: string;
    accessToken: string | null;
    refreshToken: string | null;
    idToken: string | null;
    accessTokenExpiresAt: Date | null;
    refreshTokenExpiresAt: Date | null;
    scope: string | null;
    password: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  verification: {
    id: string;
    identifier: string;
    value: string;
    expiresAt: Date;
    createdAt: Date | null;
    updatedAt: Date | null;
  };
}

export function isSignupOpen(env: AuthEnv): boolean {
  return env.OPEN_SIGNUP === "1";
}

/** Emails allowed in while the gate is closed (owner seeds their own first). */
export async function isEmailAllowed(db: D1Like, email: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT email FROM allowed_email WHERE email = ?")
    .bind(email.toLowerCase())
    .first<{ email: string }>();
  return row !== null;
}

export function createAuth(db: D1Like, env: AuthEnv, origin: string, opts: { enableEmailPassword?: boolean } = {}) {
  const kyselyDb = createD1Kysely<AuthTables>(db);
  return betterAuth({
    baseURL: origin,
    basePath: "/api/auth",
    trustedOrigins: [origin],
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: opts.enableEmailPassword ?? false },
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
        : {}),
      ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
        : {}),
    },
    session: {
      cookieCache: { enabled: true, maxAge: 300, strategy: "compact" },
    },
    account: { encryptOAuthTokens: true },
    database: kyselyAdapter(kyselyDb, { type: "sqlite" }),
    databaseHooks: {
      // Sign-up gate lives on USER creation, not session creation.
      // `user.create.before` receives the email directly (no DB read), so it
      // cannot be defeated by D1 read-after-write/replica lag mid-OAuth-callback.
      // A session.create hook did exactly that lookup and left existing users
      // permanently unable to sign in (user row present, sessions never
      // created). Returning users keep signing in; revoking access later is
      // the admin-suspend mechanism, not this gate.
      user: {
        create: {
          before: async (user) => {
            if (isSignupOpen(env)) return;
            if (!user.email || !(await isEmailAllowed(db, user.email))) return false;
          },
        },
      },
    },
    advanced: {
      useSecureCookies: origin.startsWith("https://"),
      database: {
        generateId: () => crypto.randomUUID(),
        // We own the schema via Wrangler D1 migrations (verified by workerd
        // tests); skip better-auth's live introspection, which uses PRAGMA
        // table functions that D1 blocks.
        validateSchema: false,
      },
    },
  });
}

export type AppAuth = ReturnType<typeof createAuth>;
