"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { requestPasswordReset, type ResetState } from "@/app/actions/auth";
import { Alert } from "./Alert";
import { Button } from "@/components/ui/Button";
import { site } from "@/content/site";
import { cn } from "@/lib/cn";

/*
 * /forgot-password (spec §7D.2 "Reset: request → sent → …"). With Clerk this
 * hands off to Clerk's own reset flow. On the dev preview no email can be
 * sent, so after the request (never before; owner rule 5) the page says the
 * step is being set up and how to reach the team instead.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ResetForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(requestPasswordReset, { status: "idle" });
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const shownError = error ?? (state.status === "error" ? state.message : undefined);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }

  if (state.status === "setup") {
    return (
      <div className="space-y-6">
        <div role="status">
          <Alert tone="info" title="Password reset is being set up.">
            We can’t send a reset link from this site yet, so nothing was sent to {state.email}. To get back into your account, contact our team:
          </Alert>
        </div>
        <ul className="space-y-1 text-body text-ink-body">
          {site.phone ? (
            <li>
              Phone:{" "}
              <a href={site.phone.href} className="inline-flex min-h-11 items-center text-link underline underline-offset-2">
                {site.phone.display}
              </a>
            </li>
          ) : null}
          {site.email ? (
            <li>
              Email:{" "}
              <a href={`mailto:${site.email}`} className="inline-flex min-h-11 items-center text-link underline underline-offset-2">
                {site.email}
              </a>
            </li>
          ) : null}
        </ul>
        <Link href="/login" className="inline-flex min-h-11 items-center text-body font-medium text-link underline underline-offset-2">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="space-y-6">
      <div>
        <label htmlFor="reset-email" className="text-ui font-medium text-ink">
          Email
        </label>
        <p id="reset-email-hint" className="mt-1 text-ui text-ink-muted">
          The email address you use with us.
        </p>
        <input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setError(EMAIL.test(email.trim()) ? undefined : "Enter your email address, like name@example.com.")}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={cn("reset-email-hint", shownError && "reset-email-error")}
          className={cn(
            "mt-2 min-h-12 w-full rounded-input bg-paper text-body text-ink placeholder:text-ink-muted transition-[border-color] duration-(--duration-micro) ease-riwaq",
            shownError ? "border-2 border-danger px-2.75 py-2.25" : "border border-field-border px-3 py-2.5 hov:border-ink",
          )}
          placeholder="you@example.com"
        />
        <div aria-live="polite">
          {shownError ? (
            <p id="reset-email-error" className="mt-2 flex items-start gap-1.5 text-ui text-danger">
              <CircleAlert aria-hidden="true" strokeWidth={1.5} className="mt-px size-4 shrink-0" />
              <span>{shownError}</span>
            </p>
          ) : null}
        </div>
      </div>
      <Button type="submit" variant="primary" fullWidth loading={pending} loadingLabel="Sending">
        Send a reset link
      </Button>
      <Link href="/login" className="inline-flex min-h-11 items-center text-body text-link underline underline-offset-2">
        Back to sign in
      </Link>
    </form>
  );
}
