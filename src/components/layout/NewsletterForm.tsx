"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useActionState } from "react";
import { subscribeToNewsletter, type NewsletterState } from "@/app/actions/newsletter";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

const initial: NewsletterState = { status: "idle", email: "" };

export function validateEmail(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter an email address in the format name@example.com.";
  return undefined;
}

/**
 * A network failure or server crash becomes an inline message instead of an
 * error boundary, and the typed address is kept so a retry is one click.
 */
async function subscribe(prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  try {
    return await subscribeToNewsletter(prev, formData);
  } catch {
    return {
      status: "error",
      email: String(formData.get("email") ?? ""),
      message: "We couldn't reach our server. Check your connection and try again.",
    };
  }
}

/**
 * One input, one button and one line of consent text (spec §6.2).
 * The email is checked on blur, then again on the server. The button shows
 * a spinner while pending and ignores repeat clicks.
 */
export function NewsletterForm() {
  const [state, formAction, pending] = useActionState(subscribe, initial);
  const fieldError = state.status === "error" && state.field === "email" ? state.message : undefined;
  const formMessage = state.status !== "idle" && !fieldError ? state : null;

  return (
    <form action={formAction} noValidate className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <TextField
          label="Email address"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          validate={validateEmail}
          error={fieldError}
          defaultValue={state.email}
          className="flex-1"
        />
        {/* Offset by the label's height so the button lines up with the input. */}
        <Button type="submit" variant="secondary" loading={pending} loadingLabel="Signing you up" className="sm:mt-7 sm:min-h-12">
          Subscribe
        </Button>
      </div>
      <p className="mt-3 max-w-measure text-ui text-ink-muted">
        Occasional news about classes, programs and our work. Unsubscribe at any time.
      </p>
      <div aria-live="polite">
        {formMessage ? (
          <p
            className={
              formMessage.status === "success"
                ? "mt-3 flex items-start gap-1.5 text-ui text-success"
                : "mt-3 flex items-start gap-1.5 text-ui text-danger"
            }
          >
            {formMessage.status === "success" ? (
              <CircleCheck aria-hidden="true" strokeWidth={1.5} className="mt-px size-4 shrink-0" />
            ) : (
              <CircleAlert aria-hidden="true" strokeWidth={1.5} className="mt-px size-4 shrink-0" />
            )}
            <span>{formMessage.message}</span>
          </p>
        ) : null}
      </div>
    </form>
  );
}
