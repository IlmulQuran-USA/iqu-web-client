"use client";

import { ChevronDown, CircleAlert, CircleCheck } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { sendContactMessage, type ContactState } from "@/app/actions/contact";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { checks, MESSAGE_MAX, TOPICS, type ContactField, type ContactInput } from "@/lib/contact/schema";
import { cn } from "@/lib/cn";

const empty: ContactInput = { name: "", email: "", phone: "", topic: "", message: "" };
const initial: ContactState = { status: "idle", values: empty };
const fieldId = (name: ContactField) => `contact-${name}`;
const LABELS: Record<ContactField, string> = { name: "Your name", email: "Email address", phone: "Phone", topic: "What is it about?", message: "Your message" };

const valuesOf = (data: FormData) => Object.fromEntries((Object.keys(empty) as ContactField[]).map((k) => [k, String(data.get(k) ?? "")])) as ContactInput;

/** The select and the textarea share TextField's rules: visible label, blur check, error with an icon, aria links. */
function Shell({
  name,
  label,
  hint,
  error,
  children,
}: {
  name: ContactField;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (a: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}) {
  const id = fieldId(name);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-ui font-medium text-ink">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-ui text-ink-muted">
          {hint}
        </p>
      ) : null}
      {children({ id, describedBy, invalid: Boolean(error) })}
      <div aria-live="polite">
        {error ? (
          <p id={`${id}-error`} className="mt-2 flex items-start gap-1.5 text-ui text-danger">
            <CircleAlert aria-hidden="true" strokeWidth={1.5} className="mt-px size-4 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

const control = (invalid: boolean) =>
  cn(
    "mt-2 w-full rounded-input bg-paper text-body text-ink",
    "transition-[border-color] duration-(--duration-micro) ease-riwaq",
    invalid ? "border-2 border-danger px-2.75 py-2.25" : "border border-field-border px-3 py-2.5 hov:border-ink",
  );

/**
 * /contact message form (spec §7.15; plan approved). Name, email, phone
 * (optional), topic and message; checked on blur and on submit with the same
 * rules as the server (src/lib/contact/schema.ts). On a failed submit an
 * error summary with links to each field takes focus. While sending, the
 * spinner replaces the label at a fixed width and repeat clicks are ignored.
 * A hidden honeypot field catches bots.
 */
export function ContactForm() {
  // One id per message: the same message sent again (a retry after a network error) is queued once.
  const submitId = useRef("");
  const [state, formAction, pending] = useActionState(async (prev: ContactState, data: FormData): Promise<ContactState> => {
    submitId.current ||= crypto.randomUUID();
    data.set("submitId", submitId.current);
    try {
      const next = await sendContactMessage(prev, data);
      if (next.status === "sent") submitId.current = "";
      return next;
    } catch {
      // A network failure becomes an inline message; what was typed stays.
      return { status: "error", values: valuesOf(data), message: "We couldn’t reach our server. Check your connection and send again." };
    }
  }, initial);
  // Blur results belong to one server result: a new submit starts clean, so a fixed field never keeps an old error.
  const [blur, setBlur] = useState<{ of: ContactState | null; errors: Partial<Record<ContactField, string | undefined>> }>({ of: null, errors: {} });
  const [dismissed, setDismissed] = useState<ContactState | null>(null);
  const [length, setLength] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);
  const sentRef = useRef<HTMLDivElement>(null);
  const honeypotId = useId();
  const writing = !(state.status === "sent" && dismissed !== state);

  // After a refused submit the error summary takes focus, so its links are read first.
  // After a send the submit button is gone: the thank-you takes focus instead of the page body.
  useEffect(() => {
    if (state.status === "invalid") summaryRef.current?.focus();
    if (state.status === "sent") sentRef.current?.focus();
  }, [state]);
  // "Write another message": back to the first field.
  useEffect(() => {
    if (dismissed) document.getElementById(fieldId("name"))?.focus();
  }, [dismissed]);

  const server = state.status === "invalid" ? state.errors : {};
  const blurred = blur.of === state ? blur.errors : {};
  // A field checked since the last submit shows its own result, even "no error"; otherwise the server's.
  const errorOf = (name: ContactField) => (name in blurred ? blurred[name] : server[name]);
  const check = (name: ContactField, value: string) =>
    setBlur((b) => ({ of: state, errors: { ...(b.of === state ? b.errors : {}), [name]: value.trim() ? checks[name](value) : undefined } }));
  // Summary links put the cursor in the field (a bare #anchor only scrolls), with its label in view.
  const goTo = (name: ContactField) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.querySelector(`label[for="${fieldId(name)}"]`)?.scrollIntoView({ block: "start" });
    document.getElementById(fieldId(name))?.focus({ preventScroll: true });
  };
  const v = state.values;
  const summary = state.status === "invalid" ? (Object.keys(state.errors) as ContactField[]) : [];

  if (!writing) {
    return (
      <div ref={sentRef} tabIndex={-1} className="rounded-card bg-surface p-6 sm:p-8" role="status">
        <p className="message-in flex items-start gap-2 text-body-lg font-medium text-ink">
          <CircleCheck aria-hidden="true" strokeWidth={1.5} className="mt-1 size-5 shrink-0 text-success" />
          <span>Thank you. We received your message and will reply by email.</span>
        </p>
        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => {
            setDismissed(state);
            setBlur({ of: null, errors: {} });
            setLength(0);
          }}
        >
          Write another message
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      {summary.length ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-card border-2 border-danger bg-paper p-4">
          <p className="text-body font-medium text-ink">Please check {summary.length === 1 ? "one field" : `${summary.length} fields`}:</p>
          <ul className="mt-2 flex flex-col gap-1">
            {summary.map((name) => (
              <li key={name}>
                <a href={`#${fieldId(name)}`} onClick={goTo(name)} className="inline-flex min-h-11 items-center text-body text-link underline underline-offset-2">
                  {/* Each message names its field ("Enter your name."), so no label prefix. */}
                  {state.status === "invalid" ? state.errors[name] : ""}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Honeypot: hidden from people and assistive tech, out of the tab order. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label htmlFor={honeypotId}>Website</label>
        <input id={honeypotId} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <TextField id={fieldId("name")} label={LABELS.name} name="name" autoComplete="name" defaultValue={v.name} validate={checks.name} error={server.name} />
      <TextField
        id={fieldId("email")}
        label={LABELS.email}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        spellCheck={false}
        hint="We reply to this address."
        defaultValue={v.email}
        validate={checks.email}
        error={server.email}
      />
      <TextField
        id={fieldId("phone")}
        label={LABELS.phone}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        optional
        hint="With the country code, if you would like a call back."
        defaultValue={v.phone}
        validate={checks.phone}
        error={server.phone}
      />

      <Shell name="topic" label={LABELS.topic} error={errorOf("topic")}>
        {({ id, describedBy, invalid }) => (
          <div className="relative">
            <select
              id={id}
              name="topic"
              required
              defaultValue={v.topic}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              onBlur={(e) => check("topic", e.currentTarget.value)}
              onChange={(e) => check("topic", e.currentTarget.value)}
              className={cn(control(invalid), "min-h-12 appearance-none pr-10")}
            >
              <option value="" disabled>
                Choose one
              </option>
              {TOPICS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" strokeWidth={1.5} className="pointer-events-none absolute top-1/2 right-3 mt-1 size-5 -translate-y-1/2 text-ink-muted" />
          </div>
        )}
      </Shell>

      <Shell name="message" label={LABELS.message} hint={`Up to ${MESSAGE_MAX.toLocaleString("en-US")} characters.`} error={errorOf("message")}>
        {({ id, describedBy, invalid }) => (
          <>
            <textarea
              id={id}
              name="message"
              required
              rows={6}
              defaultValue={v.message}
              aria-invalid={invalid || undefined}
              aria-describedby={[describedBy, length > MESSAGE_MAX - 400 ? `${id}-count` : null].filter(Boolean).join(" ") || undefined}
              onBlur={(e) => check("message", e.currentTarget.value)}
              onInput={(e) => setLength(e.currentTarget.value.length)}
              className={cn(control(invalid), "min-h-36 resize-y")}
            />
            {length > MESSAGE_MAX - 400 ? (
              <p id={`${id}-count`} className="mt-1 text-ui text-ink-muted tabular-nums">
                {length.toLocaleString("en-US")} of {MESSAGE_MAX.toLocaleString("en-US")} characters
              </p>
            ) : null}
          </>
        )}
      </Shell>

      <div aria-live="polite">
        {state.status === "error" ? (
          <p className="message-in flex items-start gap-1.5 text-ui font-medium text-danger">
            <CircleAlert aria-hidden="true" strokeWidth={1.5} className="mt-px size-4 shrink-0" />
            <span>{state.message}</span>
          </p>
        ) : null}
      </div>

      <div>
        <Button type="submit" variant="primary" loading={pending} loadingLabel="Sending your message" className="w-full sm:w-auto">
          Send message
        </Button>
        <p className="mt-3 max-w-measure text-ui text-ink-muted">We use your details only to answer this message.</p>
      </div>
    </form>
  );
}
