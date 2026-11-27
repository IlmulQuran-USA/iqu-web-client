"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { startTransition, useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { sendTeachApplication, type TeachState } from "@/app/actions/teach";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import {
  checks,
  COURSE_OPTIONS,
  EMPTY,
  FIELD_ORDER,
  GENDERS,
  LANGUAGES,
  MAX,
  QUALIFICATIONS,
  YES_NO,
  type TeachField,
  type TeachInput,
} from "@/lib/teach/schema";

/*
 * /teach application form (spec §7.16 without the upload; owner, 27 Nov 2026).
 * The same rules as the server (src/lib/teach/schema.ts), checked on blur and
 * on submit; never on keystroke. A refused submit puts an error summary with
 * a link to each field in focus. Choices are native checkboxes and radios in
 * fieldsets with legends; "Other" and "Yes" open the field they need. While
 * sending, the spinner replaces the label at a fixed width and repeat clicks
 * are ignored. A hidden honeypot field catches bots.
 */

const initial: TeachState = { status: "idle", values: EMPTY };
const fieldId = (name: TeachField) => `teach-${name}`;
const LIST_FIELDS = new Set<TeachField>(["courses", "languages", "qualifications"]);

function valuesOf(data: FormData): TeachInput {
  const out = { ...EMPTY };
  for (const k of FIELD_ORDER) (out as Record<string, unknown>)[k] = LIST_FIELDS.has(k) ? data.getAll(k).map(String) : String(data.get(k) ?? "");
  return out;
}

function ErrorText({ id, error }: { id: string; error?: string }) {
  return (
    <div aria-live="polite">
      {error ? (
        <p id={`${id}-error`} className="mt-2 flex items-start gap-1.5 text-ui text-danger">
          <CircleAlert aria-hidden="true" strokeWidth={1.5} className="mt-px size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

/** A group of checkboxes or radios: a fieldset whose legend is the question, one 44 px row per option. */
function Choices({
  name,
  legend,
  hint,
  type,
  options,
  selected,
  error,
  onChange,
}: {
  name: TeachField;
  legend: string;
  hint?: ReactNode;
  type: "checkbox" | "radio";
  options: readonly { value: string; label: string }[];
  selected: string[];
  error?: string;
  onChange: (values: string[]) => void;
}) {
  const id = fieldId(name);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset id={id} tabIndex={-1} aria-describedby={describedBy} aria-invalid={error ? true : undefined} className="flex flex-col">
      <legend className="text-ui font-medium text-ink">{legend}</legend>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-ui text-ink-muted">
          {hint}
        </p>
      ) : null}
      <div className={cn("mt-2 flex flex-col", error && "rounded-input border-2 border-danger px-2")}>
        {options.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5">
              <input
                type={type}
                name={name}
                value={o.value}
                checked={checked}
                onChange={(e) => onChange(type === "radio" ? [o.value] : e.currentTarget.checked ? [...selected, o.value] : selected.filter((v) => v !== o.value))}
                className="size-5 shrink-0 accent-(--primary)"
              />
              <span className="text-body text-ink">{o.label}</span>
            </label>
          );
        })}
      </div>
      <ErrorText id={id} error={error} />
    </fieldset>
  );
}

const area = (invalid: boolean) =>
  cn(
    "mt-2 w-full resize-y rounded-input bg-paper text-body text-ink transition-[border-color] duration-(--duration-micro) ease-riwaq",
    invalid ? "border-2 border-danger px-2.75 py-2.25" : "border border-field-border px-3 py-2.5 hov:border-ink",
  );

/** A textarea with TextField's rules: visible label, hint, blur check, error with an icon, aria links. */
function Area({
  name,
  label,
  hint,
  optional,
  rows,
  max,
  defaultValue,
  error,
  onCheck,
}: {
  name: TeachField;
  label: string;
  hint?: string;
  optional?: boolean;
  rows: number;
  max: number;
  defaultValue: string;
  error?: string;
  onCheck: (value: string) => void;
}) {
  const id = fieldId(name);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-ui font-medium text-ink">
        {label}
        {optional ? <span className="font-normal text-ink-muted"> (optional)</span> : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-ui text-ink-muted">
          {hint}
        </p>
      ) : null}
      <textarea
        id={id}
        name={name}
        rows={rows}
        maxLength={max}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onBlur={(e) => onCheck(e.currentTarget.value)}
        className={cn(area(Boolean(error)), rows > 3 ? "min-h-32" : "min-h-24")}
      />
      <ErrorText id={id} error={error} />
    </div>
  );
}

export function TeachForm() {
  // One id per application: the same application sent again (a retry after a network error) is saved once.
  const submitId = useRef("");
  const [state, formAction, pending] = useActionState(async (prev: TeachState, data: FormData): Promise<TeachState> => {
    submitId.current ||= crypto.randomUUID();
    data.set("submitId", submitId.current);
    try {
      const next = await sendTeachApplication(prev, data);
      if (next.status === "sent") submitId.current = "";
      return next;
    } catch {
      return { status: "error", values: valuesOf(data), message: "We couldn’t reach our server. Check your connection and send again." };
    }
  }, initial);
  const v = state.values;
  // The choice groups are controlled, so "Other" and "Yes" can open their follow-up field.
  const [picked, setPicked] = useState<{ of: TeachState; values: Pick<TeachInput, "gender" | "courses" | "languages" | "qualifications" | "ijazah"> }>({ of: state, values: v });
  const choices = picked.of === state ? picked.values : v;
  const setChoice = (field: keyof typeof choices, values: string[]) =>
    setPicked({ of: state, values: { ...choices, [field]: field === "gender" || field === "ijazah" ? (values[0] ?? "") : values } });
  const [blur, setBlur] = useState<{ of: TeachState | null; errors: Partial<Record<TeachField, string | undefined>> }>({ of: null, errors: {} });
  const summaryRef = useRef<HTMLDivElement>(null);
  const sentRef = useRef<HTMLDivElement>(null);
  const honeypotId = useId();

  useEffect(() => {
    if (state.status === "invalid") summaryRef.current?.focus();
    if (state.status === "sent") sentRef.current?.focus();
  }, [state]);

  const server = state.status === "invalid" ? state.errors : {};
  const blurred = blur.of === state ? blur.errors : {};
  const errorOf = (name: TeachField) => (name in blurred ? blurred[name] : server[name]);
  const current = { ...v, ...choices };
  const check = (name: TeachField, value: string) =>
    setBlur((b) => ({ of: state, errors: { ...(b.of === state ? b.errors : {}), [name]: value.trim() ? checks[name](value, current) : undefined } }));
  const validator = (name: TeachField) => (value: string) => checks[name](value, current);
  // A choice made since the last submit clears that group's error.
  const choose = (field: "gender" | "courses" | "languages" | "qualifications" | "ijazah") => (values: string[]) => {
    setChoice(field, values);
    setBlur((b) => ({ of: state, errors: { ...(b.of === state ? b.errors : {}), [field]: values.length ? undefined : checks[field](values, current) } }));
  };
  const goTo = (name: TeachField) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(fieldId(name));
    el?.scrollIntoView({ block: "start" });
    (el?.matches("fieldset") ? (el.querySelector("input") as HTMLElement | null) : el)?.focus({ preventScroll: true });
  };
  const summary = state.status === "invalid" ? FIELD_ORDER.filter((f) => state.errors[f]) : [];

  if (state.status === "sent") {
    return (
      <div ref={sentRef} tabIndex={-1} className="rounded-card bg-surface p-6 sm:p-8" role="status">
        <p className="message-in flex items-start gap-2 text-body-lg font-medium text-ink">
          <CircleCheck aria-hidden="true" strokeWidth={1.5} className="mt-1 size-5 shrink-0 text-success" />
          <span>Thank you. We received your application, and it has gone to our team.</span>
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      noValidate
      // Sent from here, not by React's form action: after an action React resets the form, which unchecks the
      // checkboxes and radios on screen while their state stays checked (QA, 27 Nov 2026). The action attribute
      // stays as the no-JavaScript fallback; preventDefault stops React from running it a second time.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-7"
    >
      {summary.length ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-card border-2 border-danger bg-paper p-4">
          <p className="text-body font-medium text-ink">Please check {summary.length === 1 ? "one answer" : `${summary.length} answers`}:</p>
          <ul className="mt-2 flex flex-col gap-1">
            {summary.map((name) => (
              <li key={name}>
                <a href={`#${fieldId(name)}`} onClick={goTo(name)} className="inline-flex min-h-11 items-center text-body text-link underline underline-offset-2">
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

      <TextField id={fieldId("name")} label="Full name" name="name" autoComplete="name" defaultValue={v.name} validate={validator("name")} error={server.name} />
      <TextField
        id={fieldId("email")}
        label="Email address"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        spellCheck={false}
        hint="We reply to this address."
        defaultValue={v.email}
        validate={validator("email")}
        error={server.email}
      />
      <TextField
        id={fieldId("phone")}
        label="WhatsApp number"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        hint="With the country code, for example +1 214 555 0100."
        defaultValue={v.phone}
        validate={validator("phone")}
        error={server.phone}
      />
      <TextField id={fieldId("country")} label="Country you live in" name="country" autoComplete="country-name" defaultValue={v.country} validate={validator("country")} error={server.country} />

      <Choices
        name="gender"
        legend="Gender"
        hint="Brothers learn with male teachers. Sisters, and boys up to age 10, can learn with a female teacher."
        type="radio"
        options={GENDERS}
        selected={choices.gender ? [choices.gender] : []}
        error={errorOf("gender")}
        onChange={choose("gender")}
      />
      <Choices name="courses" legend="Which courses can you teach?" hint="Choose all that apply." type="checkbox" options={COURSE_OPTIONS} selected={choices.courses} error={errorOf("courses")} onChange={choose("courses")} />
      <Choices name="languages" legend="Which languages can you teach in?" hint="Choose all that apply." type="checkbox" options={LANGUAGES} selected={choices.languages} error={errorOf("languages")} onChange={choose("languages")} />
      <Choices name="qualifications" legend="Your qualifications" hint="Choose all that apply." type="checkbox" options={QUALIFICATIONS} selected={choices.qualifications} error={errorOf("qualifications")} onChange={choose("qualifications")} />
      {choices.qualifications.includes("other") ? (
        <TextField id={fieldId("qualificationOther")} label="Your other qualification" name="qualificationOther" maxLength={MAX.other} defaultValue={v.qualificationOther} validate={validator("qualificationOther")} error={server.qualificationOther} />
      ) : null}

      <Choices name="ijazah" legend="Do you hold an Ijazah or sanad?" type="radio" options={YES_NO} selected={choices.ijazah ? [choices.ijazah] : []} error={errorOf("ijazah")} onChange={choose("ijazah")} />
      {choices.ijazah === "yes" ? (
        <TextField
          id={fieldId("ijazahDetail")}
          label="From whom, and for which recitation?"
          name="ijazahDetail"
          maxLength={MAX.ijazah}
          defaultValue={v.ijazahDetail}
          validate={validator("ijazahDetail")}
          error={server.ijazahDetail}
        />
      ) : null}

      <Area name="experience" label="Your teaching experience" hint="Where and what you have taught, for how long, and to which ages." rows={5} max={MAX.long} defaultValue={v.experience} error={errorOf("experience")} onCheck={(x) => check("experience", x)} />
      <Area name="availability" label="When can you teach?" hint="The days and hours you are free each week." rows={3} max={MAX.availability} defaultValue={v.availability} error={errorOf("availability")} onCheck={(x) => check("availability", x)} />
      <TextField id={fieldId("timeZone")} label="City or time zone you will teach from" name="timeZone" defaultValue={v.timeZone} validate={validator("timeZone")} error={server.timeZone} />
      <TextField
        id={fieldId("sampleUrl")}
        label="Link to a recitation sample"
        name="sampleUrl"
        type="url"
        inputMode="url"
        spellCheck={false}
        optional
        hint="A link to an audio or video of your recitation, for example on Google Drive or YouTube."
        defaultValue={v.sampleUrl}
        validate={validator("sampleUrl")}
        error={server.sampleUrl}
      />
      <Area name="references" label="References" hint="Teachers or institutions who know your teaching, and how to reach them." optional rows={3} max={MAX.references} defaultValue={v.references} error={errorOf("references")} onCheck={(x) => check("references", x)} />
      <Area name="message" label="Anything else you would like us to know" optional rows={3} max={MAX.long} defaultValue={v.message} error={errorOf("message")} onCheck={(x) => check("message", x)} />

      <div aria-live="polite">
        {state.status === "error" ? (
          <p className="message-in flex items-start gap-1.5 text-ui font-medium text-danger">
            <CircleAlert aria-hidden="true" strokeWidth={1.5} className="mt-px size-4 shrink-0" />
            <span>{state.message}</span>
          </p>
        ) : null}
      </div>

      <div>
        <Button type="submit" variant="primary" loading={pending} loadingLabel="Sending your application" className="w-full sm:w-auto">
          Send application
        </Button>
        <p className="mt-3 max-w-measure text-ui text-ink-muted">
          We use your details only to review your application. See our{" "}
          <a href="/legal/privacy" className="inline-flex min-h-11 items-center text-link underline underline-offset-2">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </form>
  );
}
