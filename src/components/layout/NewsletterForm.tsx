"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useActionState, useId } from "react";
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
      message: "We couldn’t reach our server. Check your connection and try again.",
    };
  }
}

/**
 * Footer newsletter form, inside the white NewsletterCard (spec §6.2; owner
 * decisions 19 and 20 Nov 2026). A visible label, the email field and a
 * filled coral Subscribe (--ink label, the field's 48 px height) on one line
 * (stacked on phones), and the privacy line under them in --ink-muted. The email is
 * checked on blur, then again on the server. While pending, the spinner
 * replaces the label at a fixed width and repeat clicks are ignored.
 * Messages are announced politely: success in --success, errors in --danger,
 * each with an icon (colour is never the only signal).
 */
export function NewsletterForm() {
  const [state, formAction, pending] = useActionState(subscribe, initial);
  const honeypotId = useId();
  const fieldError = state.status === "error" && state.field === "email" ? state.message : undefined;
  const formMessage = state.status !== "idle" && !fieldError ? state : null;

  return (
    <form action={formAction} noValidate className="w-full">
      {/* Honeypot: hidden from people and assistive tech, out of the tab order. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label htmlFor={honeypotId}>Website</label>
        <input id={honeypotId} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

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
        {/* 48 px like the field; from sm, offset by the label's height so the
            button lines up with the input.
            Pressing it keeps focus in the field: otherwise the field's blur
            check removes its error first, the stacked button jumps up on
            phones and the tap misses. The server validates every submit. */}
        <Button
          type="submit"
          variant="band"
          onMouseDown={(event) => event.preventDefault()}
          loading={pending}
          loadingLabel="Signing you up"
          className="min-h-12 sm:mt-7"
        >
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
                ? "mt-3 flex items-start gap-1.5 text-ui font-medium text-success"
                : "mt-3 flex items-start gap-1.5 text-ui font-medium text-danger"
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
