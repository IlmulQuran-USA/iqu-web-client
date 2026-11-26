"use client";

import { countries, LANGUAGES, type Language } from "@/lib/enroll/options";
import { AGE_BOUNDS, asksGuardian, isAdultOn, type Draft, type Errors } from "@/lib/enroll/schema";
import { CheckboxField, CheckChips, InputField, RadioCards, SelectField } from "./fields";
import { DateOfBirthField, PhoneField } from "./special-fields";

/*
 * Step 1 (Student) and what every step shares. The later steps live in
 * later-steps.tsx, which /enroll loads right after hydration instead of in
 * its first load (EnrollFlow; js-budget, 26 Nov 2026).
 */
/* Shared by every step. */
export type StepProps = {
  draft: Draft;
  set: (patch: Partial<Draft>) => void;
  errors: Errors;
  /** Re-check one field when it loses focus (empty fields are not flagged on blur). */
  blur: (field: string) => void;
  today: string;
  connected: boolean;
  siteKey: string | null;
  zoneDetected: boolean;
  /** False on the server and during hydration (see countryOptions). */
  hydrated: boolean;
};

/** "Ayesha", or "you" when an adult enrolls themselves. */
export function studentName(d: Draft, fallback = "the student"): string {
  if (d.who === "self") return "you";
  return d.firstName.trim() || fallback;
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function dayRange(min: number, max: number) {
  return min === max ? `${min} days a week` : `${min}–${max} days a week`;
}

/**
 * Country names come from the runtime's Intl data, which differs a little
 * between Node and each browser ("Falkland Islands" vs "Falkland Islands
 * (Islas Malvinas)"). So the server and the hydration pass render only the
 * two fixed first entries; the full list appears once the form remounts in
 * the browser (EnrollFlow), and no hydration text can mismatch.
 */
function countryOptions(hydrated: boolean) {
  if (!hydrated) {
    return (
      <>
        <option value="US">United States</option>
        <option value="CA">Canada</option>
      </>
    );
  }
  const list = countries();
  return (
    <>
      {list.slice(0, 2).map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
      <option disabled>──────────</option>
      {list.slice(2).map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </>
  );
}

/* ── 1 · Student ─────────────────────────────────────────────────────── */

export function StudentStep({ draft: d, set, errors: e, blur, today, hydrated }: StepProps) {
  const self = d.who === "self";
  const name = studentName(d);
  const adult = isAdultOn(d, today);
  const bounds = AGE_BOUNDS[d.variant];
  const dobHint =
    d.variant === "summer"
      ? "The Summer Ilm Camp is for ages 5 to 15: Level 1 is ages 5 to 10, Level 2 is ages 11 to 15."
      : d.variant === "weekend"
        ? "The Weekend Ilm Program is for ages 5 to 12."
        : undefined;
  return (
    <div className="flex flex-col gap-6">
      {d.variant === "monthly" ? (
        <RadioCards
          name="who"
          legend="Who are the classes for?"
          error={e.who}
          value={d.who}
          onChange={(who) => set({ who })}
          columns={2}
          options={[
            { value: "child", label: "My child" },
            { value: "self", label: "Myself" },
          ]}
        />
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <InputField
          name="firstName"
          label={self ? "Your first name" : "Student’s first name"}
          autoComplete={self ? "given-name" : "off"}
          maxLength={100}
          value={d.firstName}
          onChange={(firstName) => set({ firstName })}
          onBlur={() => blur("firstName")}
          error={e.firstName}
        />
        <InputField
          name="lastName"
          label={self ? "Your last name" : "Student’s last name"}
          autoComplete={self ? "family-name" : "off"}
          maxLength={100}
          value={d.lastName}
          onChange={(lastName) => set({ lastName })}
          onBlur={() => blur("lastName")}
          error={e.lastName}
        />
      </div>

      <DateOfBirthField
        name="dob"
        label={self ? "Your date of birth" : "Student’s date of birth"}
        hint={dobHint}
        error={e.dob}
        value={d.dob}
        onChange={(dob) => set({ dob })}
        onBlur={() => blur("dob")}
        minAge={bounds.min}
        maxAge={bounds.max}
        today={today}
        who={self ? "You" : d.firstName.trim() || "The student"}
      />

      {asksGuardian(d, today) ? (
        <InputField
          name="guardianName"
          label="Parent or guardian’s full name"
          hint={d.variant === "monthly" && adult === null ? "Needed for students under 18." : undefined}
          optional={d.variant === "monthly" && adult === true}
          autoComplete="name"
          maxLength={150}
          value={d.guardianName}
          onChange={(guardianName) => set({ guardianName })}
          onBlur={() => blur("guardianName")}
          error={e.guardianName}
        />
      ) : null}

      <InputField
        name="email"
        label="Email"
        hint="We send the enrollment details here."
        type="email"
        inputMode="email"
        autoComplete="email"
        spellCheck={false}
        maxLength={191}
        value={d.email}
        onChange={(email) => set({ email })}
        onBlur={() => blur("email")}
        error={e.email}
      />

      <PhoneField
        name="phone"
        label={d.variant === "summer" ? "Parent’s phone number" : "WhatsApp number"}
        hint={d.variant === "summer" ? "We call or message this number about the camp." : "We send class details and the Zoom link on WhatsApp."}
        error={e.phone}
        country={d.phoneCountry}
        number={d.phone}
        onCountry={(phoneCountry) => set({ phoneCountry })}
        onNumber={(phone) => set({ phone })}
        onBlur={() => blur("phone")}
      />
      {d.variant === "summer" ? (
        <>
          <CheckboxField
            name="whatsappSame"
            label="This number is on WhatsApp"
            checked={d.whatsappSame}
            onChange={(whatsappSame) => set({ whatsappSame })}
          />
          {!d.whatsappSame ? (
            <PhoneField
              name="whatsapp"
              label="Parent’s WhatsApp number"
              error={e.whatsapp}
              country={d.whatsappCountry}
              number={d.whatsapp}
              onCountry={(whatsappCountry) => set({ whatsappCountry })}
              onNumber={(whatsapp) => set({ whatsapp })}
              onBlur={() => blur("whatsapp")}
            />
          ) : null}
        </>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <SelectField
          name="residence"
          label="Country of residence"
          placeholder="Choose a country"
          autoComplete="country"
          value={d.residence}
          onChange={(residence) => set({ residence })}
          onBlur={() => blur("residence")}
          error={e.residence}
        >
          {countryOptions(hydrated)}
        </SelectField>
        <SelectField
          name="origin"
          label="Country of origin"
          placeholder="Choose a country"
          value={d.origin}
          onChange={(origin) => set({ origin })}
          onBlur={() => blur("origin")}
          error={e.origin}
        >
          {countryOptions(hydrated)}
        </SelectField>
      </div>

      {d.variant === "monthly" ? (
        <>
          <CheckChips
            name="languages"
            legend={self ? "Which languages do you speak comfortably?" : `Which languages does ${name} speak comfortably?`}
            hint="Choose all that apply. We match a teacher who shares one."
            error={e.languages}
            values={d.languages}
            onChange={(languages) => set({ languages: languages as Language[] })}
            options={LANGUAGES}
          />
          {d.languages.includes("other") ? (
            <InputField
              name="languagesOther"
              label="Which other language?"
              maxLength={100}
              value={d.languagesOther}
              onChange={(languagesOther) => set({ languagesOther })}
              onBlur={() => blur("languagesOther")}
              error={e.languagesOther}
            />
          ) : null}
        </>
      ) : null}

      {d.variant !== "summer" ? (
        <RadioCards
          name="existing"
          legend={self ? "Do you already study with Ilm-Ul-Quran USA?" : `Is ${name} already studying with Ilm-Ul-Quran USA?`}
          hint={
            d.variant === "weekend"
              ? "This helps us place your child in the right group. The program is free either way."
              : "New students get their first month free."
          }
          error={e.existing}
          value={d.existing}
          onChange={(existing) => set({ existing })}
          columns={2}
          options={[
            { value: "no", label: "No, we are new" },
            { value: "yes", label: "Yes, already a student" },
          ]}
        />
      ) : null}
    </div>
  );
}
