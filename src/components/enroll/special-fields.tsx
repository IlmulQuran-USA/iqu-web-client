"use client";

import { ChevronDown, Globe } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { ageOn, isRealDate, type PhoneCountry } from "@/lib/enroll/schema";
import { allZones, namedZone, zoneLabel, ZONES } from "@/lib/enroll/schedule";
import { ErrorText, fieldId } from "./fields";

const box =
  "min-h-12 w-full rounded-input bg-paper text-body text-ink transition-[border-color] duration-(--duration-micro) ease-riwaq appearance-none";
const okBorder = "border border-field-border px-3 py-2.5 hov:border-ink";
const badBorder = "border-2 border-danger px-2.75 py-2.25";

/* ── PhoneField (decision 22): US and Canada first, E.164 out ───────────── */

const PHONE_COUNTRY_LABEL: Record<PhoneCountry, string> = {
  US: "United States (+1)",
  CA: "Canada (+1)",
  OTHER: "Another country",
};

export function PhoneField({
  name,
  label,
  hint,
  error,
  country,
  number,
  onCountry,
  onNumber,
  onBlur,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  country: PhoneCountry;
  number: string;
  onCountry: (c: PhoneCountry) => void;
  onNumber: (v: string) => void;
  onBlur?: () => void;
}) {
  const other = country === "OTHER";
  const hintId = `${fieldId(name)}-hint`;
  return (
    <fieldset className="flex min-w-0 flex-col">
      <legend className="text-ui font-medium text-ink">{label}</legend>
      <p id={hintId} className="mt-1 max-w-measure text-ui text-ink-muted">
        {other ? "Type the full number with + and the country code." : (hint ?? "We send class details on WhatsApp.")}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[13rem_1fr]">
        <div className="relative">
          <label htmlFor={`${fieldId(name)}-country`} className="sr-only">
            Phone country
          </label>
          <select
            id={`${fieldId(name)}-country`}
            value={country}
            onChange={(e) => onCountry(e.target.value as PhoneCountry)}
            className={cn(box, okBorder, "pr-10")}
          >
            {(Object.keys(PHONE_COUNTRY_LABEL) as PhoneCountry[]).map((c) => (
              <option key={c} value={c}>
                {PHONE_COUNTRY_LABEL[c]}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" strokeWidth={1.5} className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-ink-muted" />
        </div>
        <div>
          <label htmlFor={fieldId(name)} className="sr-only">
            {label}
          </label>
          <input
            id={fieldId(name)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={number}
            maxLength={30}
            placeholder={other ? "+44 20 7946 0958" : "(214) 555-0123"}
            onChange={(e) => onNumber(e.target.value)}
            onBlur={onBlur}
            aria-invalid={error ? true : undefined}
            aria-describedby={[hintId, error ? `${fieldId(name)}-error` : ""].filter(Boolean).join(" ")}
            className={cn(box, error ? badBorder : okBorder, "placeholder:text-ink-muted")}
          />
        </div>
      </div>
      <ErrorText id={`${fieldId(name)}-error`} message={error} />
    </fieldset>
  );
}

/* ── Date of birth (spec §6.3 DatePicker): three labelled selects, no calendar ── */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year || 2000, month, 0)).getUTCDate();
}

export function DateOfBirthField({
  name,
  label,
  hint,
  error,
  value,
  onChange,
  onBlur,
  minAge,
  maxAge,
  today,
  who,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (iso: string) => void;
  onBlur?: () => void;
  minAge: number;
  maxAge: number;
  today: string;
  /** "Ayesha" or "You": echoed with the age once the date is complete. */
  who: string;
}) {
  // Partial picks live here until all three are chosen; the draft holds only a complete date.
  const [y0, m0, d0] = value ? value.split("-") : ["", "", ""];
  const [parts, setParts] = useState({ y: y0, m: m0, d: d0 });
  const thisYear = Number(today.slice(0, 4));
  const years = Array.from({ length: maxAge - minAge + 2 }, (_, i) => String(thisYear - minAge - i + 1)).filter(
    (y) => Number(y) <= thisYear,
  );
  const dayCount = parts.m ? daysIn(Number(parts.y), Number(parts.m)) : 31;

  function update(next: { y: string; m: string; d: string }) {
    const max = next.m ? daysIn(Number(next.y), Number(next.m)) : 31;
    const fixed = next.d && Number(next.d) > max ? { ...next, d: "" } : next;
    setParts(fixed);
    onChange(fixed.y && fixed.m && fixed.d ? `${fixed.y}-${fixed.m}-${fixed.d}` : "");
  }

  const complete = isRealDate(value);
  const age = complete && value <= today ? ageOn(value, today) : null;
  const hintId = `${fieldId(name)}-hint`;
  const sel = (bad: boolean) => cn(box, bad ? badBorder : okBorder, "pr-9");

  return (
    <fieldset
      id={fieldId(name)}
      tabIndex={-1}
      className="flex min-w-0 flex-col"
      aria-describedby={[hintId, error ? `${fieldId(name)}-error` : ""].filter(Boolean).join(" ")}
    >
      <legend className="text-ui font-medium text-ink">{label}</legend>
      <p id={hintId} className="mt-1 text-ui text-ink-muted">
        {hint}
      </p>
      <div className="mt-2 grid grid-cols-[1.4fr_1fr_1.2fr] gap-2" onBlur={onBlur}>
        {[
          { key: "m" as const, label: "Month", options: MONTHS.map((m, i) => ({ v: String(i + 1).padStart(2, "0"), l: m })) },
          { key: "d" as const, label: "Day", options: Array.from({ length: dayCount }, (_, i) => ({ v: String(i + 1).padStart(2, "0"), l: String(i + 1) })) },
          { key: "y" as const, label: "Year", options: years.map((y) => ({ v: y, l: y })) },
        ].map((f) => (
          <div key={f.key} className="relative">
            <label htmlFor={`${fieldId(name)}-${f.key}`} className="sr-only">
              {f.label}
            </label>
            <select
              id={`${fieldId(name)}-${f.key}`}
              value={parts[f.key]}
              autoComplete={{ m: "bday-month", d: "bday-day", y: "bday-year" }[f.key]}
              onChange={(e) => update({ ...parts, [f.key]: e.target.value })}
              aria-invalid={error ? true : undefined}
              className={cn(sel(Boolean(error)), !parts[f.key] && "text-ink-muted")}
            >
              <option value="">{f.label}</option>
              {f.options.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" strokeWidth={1.5} className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-muted" />
          </div>
        ))}
      </div>
      <div aria-live="polite">
        {age !== null && !error ? (
          <p className="mt-2 text-ui text-ink-body">
            {who === "You" ? `You are ${age}.` : `${who} is ${age}.`}
          </p>
        ) : null}
      </div>
      <ErrorText id={`${fieldId(name)}-error`} message={error} />
    </fieldset>
  );
}

/* ── Time zone (decision 4): detected, confirmed, changeable ─────────────── */

export function TimeZoneField({
  error,
  value,
  onChange,
  detected,
}: {
  error?: string;
  value: string;
  onChange: (iana: string) => void;
  /** True while the value is the one the device reported (not chosen by hand). */
  detected: boolean;
}) {
  const [editing, setEditing] = useState(!value);
  const named = value ? namedZone(value) : null;
  const choice = value ? (named ? (ZONES.find((z) => z.short === named)?.iana ?? "") : "OTHER") : "";
  const zones = useMemo(() => (choice === "OTHER" ? allZones() : []), [choice]);
  const name = "timeZone";

  if (!editing && value) {
    return (
      <div id={fieldId(name)} tabIndex={-1} className="flex flex-col">
        <p className="text-ui font-medium text-ink">Your time zone</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-card bg-surface p-4">
          <Globe aria-hidden="true" strokeWidth={1.5} className="size-5 text-ink-muted" />
          <span className="text-body text-ink">{zoneLabel(value)}</span>
          {detected ? <span className="text-ui text-ink-muted">from your device</span> : null}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto inline-flex min-h-11 items-center px-1 text-ui text-link underline decoration-1 underline-offset-2 hov:decoration-2"
          >
            Change<span className="sr-only"> time zone</span>
          </button>
        </div>
        <p className="mt-2 text-ui text-ink-muted">Every time below is in this zone.</p>
        <ErrorText id={`${fieldId(name)}-error`} message={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <label htmlFor={fieldId(name)} className="text-ui font-medium text-ink">
          Your time zone
        </label>
        <p className="mt-1 text-ui text-ink-muted">Every time on this page is shown in it.</p>
        <div className="relative">
          <select
            id={fieldId(name)}
            value={choice}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "OTHER") onChange(value && !named ? value : "");
              else if (v) {
                onChange(v);
                setEditing(false);
              }
            }}
            aria-invalid={error ? true : undefined}
            className={cn(box, "mt-2 pr-10", error ? badBorder : okBorder)}
          >
            <option value="">Choose your time zone</option>
            {ZONES.map((z) => (
              <option key={z.iana} value={z.iana}>
                {z.label}
              </option>
            ))}
            <option value="OTHER">Other time zone</option>
          </select>
          <ChevronDown aria-hidden="true" strokeWidth={1.5} className="pointer-events-none absolute top-1/2 right-3 mt-1 size-5 -translate-y-1/2 text-ink-muted" />
        </div>
      </div>
      {choice === "OTHER" || (value && !named) ? (
        <div className="flex flex-col">
          <label htmlFor={`${fieldId(name)}-other`} className="text-ui font-medium text-ink">
            Other time zone
          </label>
          <div className="relative">
            <select
              id={`${fieldId(name)}-other`}
              value={value && !named ? value : ""}
              onChange={(e) => {
                onChange(e.target.value);
                if (e.target.value) setEditing(false);
              }}
              className={cn(box, "mt-2 pr-10", okBorder)}
            >
              <option value="">Choose a zone</option>
              {(zones.length ? zones : allZones()).map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" strokeWidth={1.5} className="pointer-events-none absolute top-1/2 right-3 mt-1 size-5 -translate-y-1/2 text-ink-muted" />
          </div>
        </div>
      ) : null}
      <ErrorText id={`${fieldId(name)}-error`} message={error} />
    </div>
  );
}
