"use client";

import { CircleAlert, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { signIn, type SignInState } from "@/app/actions/auth";
import { Alert } from "./Alert";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/*
 * /login form (spec §7D.2, wireframe §14). Persistent labels; fields are
 * checked on blur, never on keystroke; a failed sign-in is an inline alert
 * above the form (never a toast) that takes focus and is announced; the
 * button keeps its width and shows a spinner while signing in.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const control =
  "mt-2 min-h-12 w-full rounded-input bg-paper text-body text-ink placeholder:text-ink-muted transition-[border-color] duration-(--duration-micro) ease-riwaq";
const okBorder = "border border-field-border px-3 py-2.5 hov:border-ink";
const badBorder = "border-2 border-danger px-2.75 py-2.25";

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <div aria-live="polite">
      {message ? (
        <p id={id} className="mt-2 flex items-start gap-1.5 text-ui text-danger">
          <CircleAlert aria-hidden="true" strokeWidth={1.5} className="mt-px size-4 shrink-0" />
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  );
}

export function LoginForm({ next, notice }: { next: string; notice: "signed-out" | "signin-needed" | null }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { status: "idle" });
  const [email, setEmail] = useState(state.email ?? "");
  const [shown, setShown] = useState(false);
  // Checked on blur, once the person has typed in the field ("" = checked and fine); never on keystroke.
  const [blurErrors, setBlurErrors] = useState<{ email?: string; password?: string }>({});
  const [dirty, setDirty] = useState<{ email?: boolean; password?: boolean }>({});
  const alertRef = useRef<HTMLDivElement>(null);

  const serverFields = state.status === "error" ? (state.fields ?? {}) : {};
  const errorOf = (field: "email" | "password") => (blurErrors[field] !== undefined ? blurErrors[field] || undefined : serverFields[field]);
  const errors = { email: errorOf("email"), password: errorOf("password") };
  const message = state.status === "error" ? state.message : undefined;
  // The summary is the answer to a submit: it never appears while someone is just moving through the fields.
  const summary = Object.entries(serverFields).filter(([, m]) => m) as [string, string][];

  // A refused sign-in: focus the alert so it is read out at once.
  useEffect(() => {
    if (state.status === "error" && (state.message || state.fields)) alertRef.current?.focus();
  }, [state]);

  // Submit through a transition, not the form action: React would reset the form after the action and blank the
  // controlled email field. The form action stays as the no-JavaScript path.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setBlurErrors({});
    startTransition(() => action(data));
  }

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="space-y-6">
      <input type="hidden" name="next" value={next} />

      {notice === "signed-out" && state.status === "idle" ? (
        <Alert tone="success" title="You have signed out." />
      ) : null}
      {notice === "signin-needed" && state.status === "idle" ? (
        <Alert tone="info" title="Please sign in to continue." />
      ) : null}

      {message || summary.length ? (
        <div ref={alertRef} tabIndex={-1} role="alert" className="rounded-card outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">
          <Alert tone="danger" title={message ?? "Check the highlighted fields."}>
            {summary.length && !message ? (
              <ul>
                {summary.map(([field, text]) => (
                  <li key={field}>
                    <a href={`#login-${field}`} className="inline-flex min-h-11 items-center text-link underline underline-offset-2">
                      {text}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </Alert>
        </div>
      ) : null}

      <div>
        <label htmlFor="login-email" className="text-ui font-medium text-ink">
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setDirty((d) => ({ ...d, email: true }));
          }}
          onBlur={() => {
            if (!dirty.email) return;
            setBlurErrors((b) => ({ ...b, email: EMAIL.test(email.trim()) ? "" : "Enter your email address, like name@example.com." }));
          }}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "login-email-error" : undefined}
          className={cn(control, errors.email ? badBorder : okBorder)}
          placeholder="you@example.com"
        />
        <FieldError id="login-email-error" message={errors.email} />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor="login-password" className="text-ui font-medium text-ink">
            Password
          </label>
          <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-ui text-link underline underline-offset-2 hov:decoration-2">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="login-password"
            name="password"
            type={shown ? "text" : "password"}
            autoComplete="current-password"
            required
            onChange={() => setDirty((d) => ({ ...d, password: true }))}
            onBlur={(e) => {
              if (!dirty.password) return;
              setBlurErrors((b) => ({ ...b, password: e.target.value ? "" : "Enter your password." }));
            }}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "login-password-error" : undefined}
            className={cn(control, "pr-14", errors.password ? badBorder : okBorder)}
          />
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-pressed={shown}
            aria-controls="login-password"
            className="absolute top-2 right-0.5 inline-flex size-11 items-center justify-center rounded-button text-ink-muted transition-colors duration-(--duration-micro) ease-riwaq hov:text-ink"
          >
            {shown ? <EyeOff aria-hidden="true" strokeWidth={1.5} className="size-5" /> : <Eye aria-hidden="true" strokeWidth={1.5} className="size-5" />}
            <span className="sr-only">{shown ? "Hide password" : "Show password"}</span>
          </button>
        </div>
        <FieldError id="login-password-error" message={errors.password} />
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-ink-body">
        <input type="checkbox" name="remember" className="size-5 shrink-0 accent-(--primary)" />
        Remember me on this device
      </label>

      <Button type="submit" variant="primary" fullWidth loading={pending} loadingLabel="Signing in">
        Sign in
      </Button>
    </form>
  );
}
