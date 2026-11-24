"use client";

import { ChevronDown, CircleAlert, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Controlled form primitives for /enroll (spec §6.3: Select, RadioGroup,
 * CheckboxGroup, InlineAlert; DESIGN.md §9 "Forms").
 *
 * - Labels are always visible; hints sit under the label.
 * - Errors come from the step rules (on blur and on Continue), sit beside the
 *   field with an icon and text, and are announced through aria-live.
 * - Every field has the anchor id `enroll-<name>`, so the error summary can
 *   link to it.
 * - Every target is at least 44 × 44 px; the global focus ring is never removed.
 */

export const fieldId = (name: string) => `enroll-${name}`;

const control =
  "mt-2 min-h-12 w-full rounded-input bg-paper text-body text-ink placeholder:text-ink-muted " +
  "transition-[border-color] duration-(--duration-micro) ease-riwaq disabled:cursor-not-allowed disabled:bg-surface disabled:text-ink-muted";
const okBorder = "border border-field-border px-3 py-2.5 hov:not-disabled:border-ink";
const badBorder = "border-2 border-danger px-2.75 py-2.25";

export function ErrorText({ id, message }: { id: string; message?: string }) {
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

type Shared = {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  optional?: boolean;
  error?: string;
  className?: string;
};

function describedBy(name: string, hint: unknown, error: unknown) {
  return [hint ? `${fieldId(name)}-hint` : null, error ? `${fieldId(name)}-error` : null].filter(Boolean).join(" ") || undefined;
}

function Label({ name, label, optional }: { name: string; label: ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={fieldId(name)} className="text-ui font-medium text-ink">
      {label}
      {optional ? <span className="font-normal text-ink-muted"> (optional)</span> : null}
    </label>
  );
}

function Hint({ name, hint }: { name: string; hint?: ReactNode }) {
  return hint ? (
    <p id={`${fieldId(name)}-hint`} className="mt-1 max-w-measure text-ui text-ink-muted">
      {hint}
    </p>
  ) : null;
}

export function InputField({
  name,
  label,
  hint,
  optional,
  error,
  className,
  value,
  onChange,
  onBlur,
  ...rest
}: Shared & {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
} & Omit<React.ComponentPropsWithoutRef<"input">, "value" | "onChange" | "onBlur" | "name" | "id">) {
  return (
    <div className={cn("flex flex-col", className)}>
      <Label name={name} label={label} optional={optional} />
      <Hint name={name} hint={hint} />
      <input
        {...rest}
        id={fieldId(name)}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        required={!optional}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={cn(control, error ? badBorder : okBorder)}
      />
      <ErrorText id={`${fieldId(name)}-error`} message={error} />
    </div>
  );
}

export function TextareaField({
  name,
  label,
  hint,
  optional,
  error,
  className,
  value,
  onChange,
  onBlur,
  maxLength,
  rows = 3,
}: Shared & { value: string; onChange: (v: string) => void; onBlur?: () => void; maxLength: number; rows?: number }) {
  return (
    <div className={cn("flex flex-col", className)}>
      <Label name={name} label={label} optional={optional} />
      <Hint name={name} hint={hint} />
      <textarea
        id={fieldId(name)}
        name={name}
        value={value}
        rows={rows}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        required={!optional}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, hint, error)}
        className={cn(control, "resize-y", error ? badBorder : okBorder)}
      />
      <ErrorText id={`${fieldId(name)}-error`} message={error} />
    </div>
  );
}

export function SelectField({
  name,
  label,
  hint,
  optional,
  error,
  className,
  value,
  onChange,
  onBlur,
  placeholder,
  children,
  autoComplete,
}: Shared & {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder: string;
  children: ReactNode;
  autoComplete?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <Label name={name} label={label} optional={optional} />
      <Hint name={name} hint={hint} />
      <div className="relative">
        <select
          id={fieldId(name)}
          name={name}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          required={!optional}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(name, hint, error)}
          className={cn(control, "appearance-none pr-10", error ? badBorder : okBorder, !value && "text-ink-muted")}
        >
          <option value="">{placeholder}</option>
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.5}
          className="pointer-events-none absolute top-1/2 right-3 mt-1 size-5 -translate-y-1/2 text-ink-muted"
        />
      </div>
      <ErrorText id={`${fieldId(name)}-error`} message={error} />
    </div>
  );
}

/** Radio cards in a fieldset (spec §6.3 RadioGroup). One choice; arrow keys move between options natively. */
export function RadioCards<V extends string>({
  name,
  legend,
  hint,
  error,
  value,
  onChange,
  options,
  columns = 1,
  className,
}: {
  name: string;
  legend: ReactNode;
  hint?: ReactNode;
  error?: string;
  value: V | "";
  onChange: (v: V) => void;
  options: readonly { value: V; label: ReactNode; hint?: ReactNode; disabled?: boolean }[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[columns];
  return (
    <fieldset
      id={fieldId(name)}
      tabIndex={-1}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(name, hint, error)}
      className={cn("min-w-0", className)}
    >
      <legend className="text-ui font-medium text-ink">{legend}</legend>
      <Hint name={name} hint={hint} />
      <div className={cn("mt-2 grid gap-2", cols)}>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-input border bg-paper px-3 py-2.5",
              "transition-[border-color,background-color] duration-(--duration-micro) ease-riwaq",
              "hov:border-ink has-checked:border-ink has-checked:bg-surface",
              "has-disabled:cursor-not-allowed has-disabled:opacity-60",
              error ? "border-danger" : "border-field-border",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="mt-0.5 size-5 shrink-0 accent-(--primary)"
            />
            <span className="flex min-w-0 flex-col">
              <span className="text-body text-ink">{o.label}</span>
              {o.hint ? <span className="text-ui text-ink-muted">{o.hint}</span> : null}
            </span>
          </label>
        ))}
      </div>
      <ErrorText id={`${fieldId(name)}-error`} message={error} />
    </fieldset>
  );
}

/** Multi-select chips (spec §6.3 CheckboxGroup), e.g. days of the week. */
export function CheckChips<V extends string>({
  name,
  legend,
  hint,
  error,
  values,
  onChange,
  options,
  max,
}: {
  name: string;
  legend: ReactNode;
  hint?: ReactNode;
  error?: string;
  values: readonly V[];
  onChange: (v: V[]) => void;
  options: readonly { value: V; label: string; short?: string }[];
  /** Once this many are chosen, the rest are disabled. */
  max?: number;
}) {
  const full = max !== undefined && values.length >= max;
  return (
    <fieldset
      id={fieldId(name)}
      tabIndex={-1}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(name, hint, error)}
      className="min-w-0"
    >
      <legend className="text-ui font-medium text-ink">{legend}</legend>
      <Hint name={name} hint={hint} />
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = values.includes(o.value);
          return (
            <label
              key={o.value}
              className={cn(
                "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-pill border px-4 text-body",
                "transition-[border-color,background-color,color] duration-(--duration-micro) ease-riwaq",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus)",
                checked ? "border-ink bg-ink text-paper" : "border-field-border bg-paper text-ink hov:border-ink",
                !checked && full && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={!checked && full}
                onChange={() => onChange(checked ? values.filter((v) => v !== o.value) : [...values, o.value])}
              />
              {o.short ? (
                <>
                  <span aria-hidden="true">{o.short}</span>
                  <span className="sr-only">{o.label}</span>
                </>
              ) : (
                o.label
              )}
            </label>
          );
        })}
      </div>
      <ErrorText id={`${fieldId(name)}-error`} message={error} />
    </fieldset>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  error,
  checked,
  onChange,
}: {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col">
      <label htmlFor={fieldId(name)} className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
        <input
          id={fieldId(name)}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(name, hint, error)}
          className="mt-0.5 size-5 shrink-0 accent-(--primary)"
        />
        <span className="text-body text-ink">{label}</span>
      </label>
      {hint ? (
        <p id={`${fieldId(name)}-hint`} className="ml-8 text-ui text-ink-muted">
          {hint}
        </p>
      ) : null}
      <ErrorText id={`${fieldId(name)}-error`} message={error} />
    </div>
  );
}

/** A soft notice (spec §6.3 InlineAlert). Status colours are always tint + strong text. */
export function InlineAlert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "bg-info-tint text-ink [--alert-icon:var(--info)]",
    warning: "bg-warning-tint text-ink [--alert-icon:var(--warning)]",
    danger: "bg-danger-tint text-ink [--alert-icon:var(--danger)]",
    success: "bg-success-tint text-ink [--alert-icon:var(--success)]",
  };
  const Icon = tone === "danger" || tone === "warning" ? CircleAlert : Info;
  return (
    <div className={cn("flex gap-3 rounded-card p-4", tones[tone], className)}>
      <Icon aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-(--alert-icon)" />
      <div className="min-w-0 text-ui">
        {title ? <p className="font-medium text-ink">{title}</p> : null}
        {children ? <div className={cn("text-ink-body", title ? "mt-1" : undefined)}>{children}</div> : null}
      </div>
    </div>
  );
}

/** A system fact the family does not edit here (a ReadOnlyFact cousin for public pages). */
export function FactCard({ title, children, className }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-card bg-surface p-4", className)}>
      <p className="text-body font-medium text-ink">{title}</p>
      {children ? <div className="mt-1 text-ui text-ink-body">{children}</div> : null}
    </div>
  );
}
