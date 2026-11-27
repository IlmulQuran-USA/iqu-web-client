"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getData } from "@/data";
import { safeNext } from "@/lib/auth/access";
import { SESSION_COOKIE, SESSION_LONG_S, SESSION_SHORT_S, sameSecret, signSession } from "@/lib/auth/session";
import { clientIp } from "@/lib/server/keys";
import { allow, clientKey } from "@/lib/server/rate-limit";
import { portalAuth, previewPassword } from "@/lib/site-env";

/*
 * Sign-in, sign-out and the password-reset handoff (portal Batch 1). The
 * preview sign-in runs on dev only (src/lib/site-env.ts portalAuth): the four
 * preview accounts and the one password from PREVIEW_DEFAULT_PASSWORD, which
 * is compared in constant time and never logged, echoed or stored. With Clerk
 * (later), sign-in and reset happen in Clerk's own components.
 */

export type SignInState = {
  status: "idle" | "error";
  /** The message shown in the alert above the form. */
  message?: string;
  fields?: { email?: string; password?: string };
  email?: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIGN_IN_MESSAGES = {
  mismatch: "That email and password don't match. Check your password or reset it.",
  limited: "Too many tries. Please wait 15 minutes and try again.",
  closed: "Sign-in is being set up. Please try again later.",
  email: "Enter your email address, like name@example.com.",
  password: "Enter your password.",
} as const;

const WINDOW_MS = 15 * 60 * 1000;

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(form.get("password") ?? "").slice(0, 256);
  const remember = form.get("remember") === "on";
  const next = String(form.get("next") ?? "");

  const fields: SignInState["fields"] = {};
  if (!EMAIL.test(email)) fields.email = SIGN_IN_MESSAGES.email;
  if (!password) fields.password = SIGN_IN_MESSAGES.password;
  if (fields.email || fields.password) return { status: "error", fields, email };

  if (portalAuth() !== "preview") return { status: "error", message: SIGN_IN_MESSAGES.closed, email };
  const secret = previewPassword() as string;

  // Five tries per 15 minutes, per address and per email: kept in this server's memory only (keyed hashes).
  const ip = clientIp(await headerGetter());
  if ((ip && !allow(`login-ip:${clientKey(ip)}`, 5, WINDOW_MS)) || !allow(`login-email:${clientKey(email)}`, 5, WINDOW_MS)) {
    return { status: "error", message: SIGN_IN_MESSAGES.limited, email };
  }

  const account = await getData().people.accountByEmail(email);
  const ok = (await sameSecret(password, secret)) && account !== null;
  if (!account || !ok) return { status: "error", message: SIGN_IN_MESSAGES.mismatch, email };

  const lifetime = remember ? SESSION_LONG_S : SESSION_SHORT_S;
  const token = await signSession(
    { sub: account.id, email: account.email, name: account.name, roles: account.roles, exp: Math.floor(Date.now() / 1000) + lifetime },
    secret,
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: SESSION_LONG_S } : {}),
  });
  redirect(safeNext(next, account.roles));
}

async function headerGetter() {
  const h = await headers();
  return (name: string) => h.get(name);
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login?signed-out=1");
}

export type ResetState = { status: "idle" | "error" | "setup"; message?: string; email?: string };

/** The reset request. Preview: no email can be sent, so the page says the step is being set up (after the request, never before). */
export async function requestPasswordReset(_prev: ResetState, form: FormData): Promise<ResetState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  if (!EMAIL.test(email)) return { status: "error", message: SIGN_IN_MESSAGES.email, email };
  return { status: "setup", email };
}
