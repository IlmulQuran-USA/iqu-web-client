"use client";

/*
 * Steps 2 to 5 of /enroll (Course, Schedule, Fees, Weekend schedule, Summer
 * fee, Review). Not in /enroll's first load: EnrollFlow imports this module
 * lazily, starts loading it as soon as the page hydrates, and waits for it
 * before restoring a draft saved on a later step, so a step never appears
 * empty (js-budget, 26 Nov 2026). Step 1 and the shared props are steps.tsx.
 */

import Link from "next/link";
import { useState } from "react";
import { checkCoupon } from "@/app/actions/enroll";
import { Button } from "@/components/ui/Button";
import { monthlyCourses, type CourseId } from "@/content/pricing";
import { afterHelp, allowedDays, money, quoteMonthly, SUMMER_STANDARD_FEE } from "@/lib/enroll/fees";
import {
  HELP_LEVELS,
  QURAN_LEVELS,
  REFERRALS,
  TEACHER_PREFS,
  WEEKDAYS,
  type HelpLevel,
  type QuranLevel,
  type Referral,
  type TeacherPref,
  type Weekday,
} from "@/lib/enroll/options";
import { isHifz, summerLevel, type Draft, type StepId } from "@/lib/enroll/schema";
import { clockLabel, minutesOf, TIME_OPTIONS, zoneShort } from "@/lib/enroll/schedule";
import { CheckboxField, CheckChips, FactCard, InlineAlert, InputField, RadioCards, SelectField, TextareaField } from "./fields";
import { getRecaptchaToken } from "./recaptcha";
import { TimeZoneField } from "./special-fields";
import { cap, dayRange, studentName, type StepProps } from "./steps";
/* ── 2 · Course (monthly) ────────────────────────────────────────────── */

export function CourseStep({ draft: d, set, errors: e, blur }: StepProps) {
  const name = studentName(d);
  const hifz = isHifz(d);
  return (
    <div className="flex flex-col gap-6">
      <RadioCards
        name="courseId"
        legend="Course"
        error={e.courseId}
        value={d.courseId}
        onChange={(courseId: CourseId) => {
          const c = monthlyCourses.find((x) => x.id === courseId)!;
          // Keep a day count that still fits; a fixed course sets its own.
          const days = d.daysPerWeek && allowedDays(c).includes(d.daysPerWeek) ? d.daysPerWeek : c.minDays === c.maxDays ? c.minDays : 0;
          set({ courseId, daysPerWeek: days, days: d.days.slice(0, days || 7), special: false, couponApplied: null });
        }}
        columns={2}
        options={monthlyCourses.map((c) => ({
          value: c.id,
          label: c.label,
          hint: `${dayRange(c.minDays, c.maxDays)} · from ${money(quoteMonthly(c.id, c.minDays)!.full)} a month`,
        }))}
      />
      <p className="text-ui text-ink-muted">
        Looking for a program instead? See the{" "}
        <Link href="/enroll?program=weekend-ilm-program" className="text-link underline underline-offset-2">
          Weekend Ilm Program
        </Link>{" "}
        (ages 5–12, free) or the{" "}
        <Link href="/enroll?program=summer-ilm-camp" className="text-link underline underline-offset-2">
          Summer Ilm Camp
        </Link>
        .
      </p>

      <RadioCards
        name="quranLevel"
        legend={d.who === "self" ? "Where are you with the Quran today?" : `Where is ${name} with the Quran today?`}
        error={e.quranLevel}
        value={d.quranLevel}
        onChange={(quranLevel: QuranLevel) => set({ quranLevel })}
        columns={2}
        options={QURAN_LEVELS}
      />
      {hifz && (d.quranLevel === "no_letters" || d.quranLevel === "qaidah") ? (
        <InlineAlert title="A note about Hifz">
          Quran Hifz is for students who can already read the Quran fluently (Nazirah level). Our team will check the level with you, or
          you can choose Noorani Qaidah or Quran Nazirah to start.
        </InlineAlert>
      ) : null}

      <TextareaField
        name="memorized"
        label={d.who === "self" ? "What have you memorized so far?" : `What has ${name} memorized so far?`}
        hint="For example: Juz 30, or Surah Al-Mulk. Write “None yet” if nothing."
        optional={!hifz}
        maxLength={500}
        value={d.memorized}
        onChange={(memorized) => set({ memorized })}
        onBlur={() => blur("memorized")}
        error={e.memorized}
      />

      <RadioCards
        name="teacherPref"
        legend="Teacher preference"
        hint="Sisters, and boys up to age 10, can learn with a female teacher. Brothers learn with male teachers."
        error={e.teacherPref}
        value={d.teacherPref}
        onChange={(teacherPref: TeacherPref) => set({ teacherPref })}
        columns={3}
        options={TEACHER_PREFS}
      />
    </div>
  );
}

/* ── 3 · Schedule (monthly) ──────────────────────────────────────────── */

/** Half-hour choices (48, not 96), grouped so a long list scans quickly. The rules still accept quarter hours. */
const HALF_HOURS = TIME_OPTIONS.filter((t) => t.value.endsWith(":00") || t.value.endsWith(":30"));

function timeGroups(options: readonly { value: string; label: string }[]) {
  const groups = [
    { label: "Morning", test: (m: number) => m < 12 * 60 },
    { label: "Afternoon", test: (m: number) => m >= 12 * 60 && m < 17 * 60 },
    { label: "Evening", test: (m: number) => m >= 17 * 60 },
  ];
  return groups.map((g) => {
    const items = options.filter((o) => g.test(minutesOf(o.value)));
    return items.length ? (
      <optgroup key={g.label} label={g.label}>
        {items.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </optgroup>
    ) : null;
  });
}

export function ScheduleStep({ draft: d, set, errors: e, blur, zoneDetected }: StepProps) {
  const course = d.courseId ? monthlyCourses.find((c) => c.id === d.courseId) : undefined;
  const fixed = course && course.minDays === course.maxDays;
  const zone = d.timeZone ? zoneShort(d.timeZone) : "";
  const toOptions = HALF_HOURS.filter((t) => !d.from || minutesOf(t.value) > minutesOf(d.from));
  const dayNames = WEEKDAYS.filter((w) => d.days.includes(w.value)).map((w) => w.label);
  const ready = d.from && d.to && !e.to && minutesOf(d.to) > minutesOf(d.from) && d.days.length && d.classLength;

  return (
    <div className="flex flex-col gap-6">
      <TimeZoneField error={e.timeZone} value={d.timeZone} onChange={(timeZone) => set({ timeZone })} detected={zoneDetected} />

      {fixed ? (
        <FactCard title={`${course.minDays} days a week`}>{course.label} meets {course.minDays} days a week.</FactCard>
      ) : (
        <RadioCards
          name="daysPerWeek"
          legend="How many days a week?"
          hint={course && course.minDays > 1 ? `${course.label} needs at least ${course.minDays} days a week to make steady progress.` : undefined}
          error={e.daysPerWeek}
          value={d.daysPerWeek ? (String(d.daysPerWeek) as `${number}`) : ""}
          onChange={(v) => {
            const n = Number(v);
            set({ daysPerWeek: n, days: d.days.slice(0, n) });
          }}
          columns={4}
          options={(course ? allowedDays(course) : [1, 2, 3, 4, 5, 6, 7]).map((n) => ({
            value: String(n) as `${number}`,
            label: n === 1 ? "1 day" : `${n} days`,
          }))}
        />
      )}

      <CheckChips
        name="days"
        legend="Which days work best?"
        hint={d.daysPerWeek ? `Choose up to ${d.daysPerWeek}.` : "Choose how many days a week first."}
        error={e.days}
        values={d.days as Weekday[]}
        onChange={(days) => set({ days })}
        options={WEEKDAYS}
        max={d.daysPerWeek || 0}
      />

      <RadioCards
        name="classLength"
        legend="Class length"
        hint="Class length does not change the fee."
        error={e.classLength}
        value={d.classLength ? (String(d.classLength) as `${number}`) : ""}
        onChange={(v) => set({ classLength: Number(v) })}
        columns={4}
        options={[30, 40, 50, 60].map((n) => ({ value: String(n) as `${number}`, label: `${n} minutes` }))}
      />

      <fieldset className="min-w-0">
        <legend className="text-ui font-medium text-ink">Between which times are you free?</legend>
        <p className="mt-1 max-w-measure text-ui text-ink-muted">
          The earliest start and the latest end{zone ? `, in ${zone}` : ""}. A teacher is matched to a time between them.
        </p>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <SelectField
            name="from"
            label="From"
            placeholder="Earliest start"
            value={d.from}
            onChange={(from) => set({ from, to: d.to && minutesOf(d.to) <= minutesOf(from) ? "" : d.to })}
            onBlur={() => blur("from")}
            error={e.from}
          >
            {timeGroups(HALF_HOURS)}
          </SelectField>
          <SelectField
            name="to"
            label="To"
            placeholder="Latest end"
            value={d.to}
            onChange={(to) => set({ to })}
            onBlur={() => blur("to")}
            error={e.to}
          >
            {timeGroups(toOptions)}
          </SelectField>
        </div>
      </fieldset>

      {ready ? (
        <FactCard title="Your schedule">
          <span aria-live="polite">
            {cap(studentName(d))} {d.who === "self" ? "are" : "is"} free {dayNames.join(", ")}, {clockLabel(d.from)}–{clockLabel(d.to)} {zone}. Each
            class is {d.classLength} minutes.
          </span>
        </FactCard>
      ) : null}
    </div>
  );
}

/* ── 4 · Fees (monthly) ──────────────────────────────────────────────── */

export const PAYMENT_FAQ = [
  { q: "Is the first month really free?", a: "Yes. New students get their first 30 days of classes free. Nothing is charged during the free month." },
  {
    q: "Why add a card now?",
    a: "To keep your place. Please add a card or US bank account within 7 days, or the enrollment is put on hold. Nothing is charged during the free month.",
  },
  { q: "When is the first charge?", a: "After the free first month, tuition is charged on the 1st of each month." },
  {
    q: "How do I cancel?",
    a: "Message us at info@ilmulquranus.org or on WhatsApp at least 7 days before your next charge. Classes continue until the end of the month you have paid for.",
  },
] as const;

/**
 * The answers that fit the family's choice (critique P1). Families asking for
 * help, or using a scholarship code, add a card only after the fee is agreed
 * (owner decision 3); current students have no free month.
 */
export function paymentFaq(d: Draft): readonly { q: string; a: string }[] {
  const [firstMonth, addCard, firstCharge, cancel] = PAYMENT_FAQ;
  if (d.feeChoice === "help" || d.feeChoice === "code") {
    return [
      {
        q: "When do I add a card?",
        a: "Only after our team agrees the fee with you. Nothing is charged before that, and a full scholarship needs no card at all.",
      },
      { q: "Will asking for help affect my child’s place?", a: "No. No child’s place is ever affected by cost." },
      { q: "Who reads what I write?", a: "Only our team. It is never shared." },
      cancel,
    ];
  }
  if (d.existing === "yes") {
    return [
      { q: "When do I add a card?", a: "Our team confirms the fee with you first, then sends you a secure link to add a card or US bank account." },
      { q: "When is the first charge?", a: "Tuition is charged on the 1st of each month. Current students don’t get a second free month." },
      cancel,
    ];
  }
  return [firstMonth, addCard, firstCharge, cancel];
}

export function FeesStep({ draft: d, set, errors: e, blur, connected, siteKey }: StepProps) {
  const quote = d.courseId && d.daysPerWeek ? quoteMonthly(d.courseId, d.daysPerWeek) : null;
  const existing = d.existing === "yes";
  const [coupon, setCoupon] = useState<{ busy: boolean; message: string; tone: "danger" | "info" }>({ busy: false, message: "", tone: "info" });

  if (!quote) {
    return <InlineAlert tone="warning" title="Choose a course and days first">Go back to the Course and Schedule steps to see the fee.</InlineAlert>;
  }

  async function applyCode() {
    const code = d.couponCode.trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,40}$/.test(code)) {
      setCoupon({ busy: false, message: "Check the code: it uses letters, numbers and dashes.", tone: "danger" });
      return;
    }
    if (!connected || !siteKey) {
      setCoupon({
        busy: false,
        message: "Checking codes is being set up. Please keep your code: our team applies it when they confirm your fee.",
        tone: "info",
      });
      return;
    }
    setCoupon({ busy: true, message: "", tone: "info" });
    try {
      const token = await getRecaptchaToken(siteKey, "iqu_apply_coupon");
      const res = await checkCoupon({ code, courseId: d.courseId, daysPerWeek: d.daysPerWeek, recaptchaToken: token });
      if (res.status === "ok") {
        set({ couponApplied: res.coupon, couponCode: res.coupon.code, zakatDeclaration: false });
        setCoupon({ busy: false, message: "", tone: "info" });
      } else {
        set({ couponApplied: null });
        setCoupon({ busy: false, message: res.status === "error" ? res.message : "Codes can’t be checked right now.", tone: "danger" });
      }
    } catch {
      setCoupon({ busy: false, message: "We couldn’t check the code just now. Please try again.", tone: "danger" });
    }
  }

  const applied = d.couponApplied && d.couponApplied.code === d.couponCode.trim().toUpperCase() ? d.couponApplied : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card bg-surface p-5">
        <p className="text-ui text-ink-muted">Monthly fee</p>
        <p className="mt-1 font-display text-heading-lg font-semibold text-ink">
          {money(quote.full)} <span className="font-sans text-body font-normal text-ink-body">a month</span>
        </p>
        <p className="mt-1 text-ui text-ink-body">
          {quote.course.label} · {quote.daysPerWeek} {quote.daysPerWeek === 1 ? "day" : "days"} a week · {quote.classesPerMonth} classes a month (
          {money(quote.perClass)} a class)
        </p>
        <p className="mt-3 text-ui text-ink-body">
          {existing
            ? "Current students don’t get a second free month. Our team confirms the fee with you."
            : d.feeChoice === "help" || d.feeChoice === "code"
              ? "Your first month is free. Our team agrees the fee with you before any payment."
              : "Your first month is free. After the free first month, tuition is charged on the 1st of each month."}
        </p>
        <p className="mt-1 text-ui text-ink-muted">Listed prices are the full monthly fees. Class length does not change the fee.</p>
      </div>

      <RadioCards
        name="feeChoice"
        legend="How would you like to pay?"
        error={e.feeChoice}
        value={d.feeChoice}
        onChange={(feeChoice) => set({ feeChoice })}
        options={[
          {
            value: "pay",
            label: "I can pay the monthly fee",
            hint: existing
              ? "Our team confirms the fee with you before any payment."
              : "Next, you add a card or US bank account on our secure Stripe page. Nothing is charged during the free month.",
          },
          {
            value: "help",
            label: "I need help with the fee",
            hint: "Ask for a reduced fee or a full scholarship. About half of our students receive help with fees.",
          },
          { value: "code", label: "I have a scholarship code", hint: "Use the code our team sent you." },
        ]}
      />

      {d.feeChoice === "pay" && quote.special !== null ? (
        <CheckboxField
          name="special"
          label={
            <>
              Choose the Special plan: <strong className="font-medium">{money(quote.special)} a month</strong> instead of {money(quote.full)}
            </>
          }
          hint="For Qaidah and Nazirah at 3 to 7 days a week."
          checked={d.special}
          onChange={(special) => set({ special })}
        />
      ) : null}

      {d.feeChoice === "help" ? (
        <div className="flex flex-col gap-6 border-l-2 border-rule pl-4">
          <RadioCards
            name="helpLevel"
            legend="How much help would you like to ask for?"
            error={e.helpLevel}
            value={d.helpLevel}
            onChange={(helpLevel: HelpLevel) => set({ helpLevel })}
            columns={2}
            options={HELP_LEVELS.map((h) => ({
              value: h.value,
              label: h.label,
              hint: h.value === "full" ? "You would pay nothing." : `You would pay ${money(afterHelp(quote.full, h.value))} a month.`,
            }))}
          />
          <TextareaField
            name="helpNote"
            label="Anything you would like us to know?"
            hint="Private. Only our team reads this."
            optional
            maxLength={500}
            value={d.helpNote}
            onChange={(helpNote) => set({ helpNote })}
          />
          <p className="text-ui text-ink-body">
            Our team contacts you privately. You add a card only after we agree the fee together.
          </p>
        </div>
      ) : null}

      {d.feeChoice === "code" ? (
        <div className="flex flex-col gap-4 border-l-2 border-rule pl-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <InputField
              name="couponCode"
              label="Scholarship code"
              className="sm:flex-1"
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              value={d.couponCode}
              onChange={(couponCode) => set({ couponCode: couponCode.toUpperCase(), zakatDeclaration: false })}
              onBlur={() => blur("couponCode")}
              error={e.couponCode}
              readOnly={Boolean(applied)}
            />
            {applied ? (
              <Button variant="secondary" className="sm:mt-7.5" onClick={() => set({ couponApplied: null, couponCode: "", zakatDeclaration: false })}>
                Remove
              </Button>
            ) : (
              <Button variant="secondary" className="sm:mt-7.5" loading={coupon.busy} loadingLabel="Checking the code" onClick={applyCode}>
                Apply
              </Button>
            )}
          </div>
          <div aria-live="polite">
            {coupon.message ? <InlineAlert tone={coupon.tone}>{coupon.message}</InlineAlert> : null}
            {applied ? (
              <InlineAlert tone="success" title={`Code applied: ${applied.percent}% from the Zakat fund`}>
                Regular fee {money(quote.full)} · scholarship −{money(applied.discount)} · you pay {money(applied.final)} a month.
              </InlineAlert>
            ) : null}
          </div>
          {applied ? (
            <CheckboxField
              name="zakatDeclaration"
              label={applied.declaration}
              error={e.zakatDeclaration}
              checked={d.zakatDeclaration}
              onChange={(zakatDeclaration) => set({ zakatDeclaration })}
            />
          ) : null}
        </div>
      ) : null}

      <PaymentFaq items={paymentFaq(d)} />
    </div>
  );
}

export function PaymentFaq({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div>
      <h2 className="text-ui font-medium text-ink">How payment works</h2>
      <div className="mt-2 divide-y divide-rule border-y border-rule">
        {items.map((item, i) => (
          <details key={item.q} open={i === 0} className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-2 text-body text-ink [&::-webkit-details-marker]:hidden">
              {item.q}
              <span aria-hidden="true" className="text-ink-muted transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="pb-3 text-ui text-ink-body">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

/* ── Weekend: schedule and consent ───────────────────────────────────── */

export function WeekendScheduleStep({
  draft: d,
  set,
  errors: e,
  zoneDetected,
  timeLine,
}: StepProps & { timeLine: (zone: string) => { home: string; local: string | null } }) {
  const t = timeLine(d.timeZone);
  return (
    <div className="flex flex-col gap-6">
      <TimeZoneField error={e.timeZone} value={d.timeZone} onChange={(timeZone) => set({ timeZone })} detected={zoneDetected} />
      <FactCard title={`Saturday and Sunday, ${t.local ?? t.home}`}>
        {t.local ? <>That is {t.home}. </> : null}
        Two live classes a week on Zoom, one hour each. Free for every child.
      </FactCard>
      <CheckboxField
        name="timingConsent"
        label={`I confirm ${d.firstName.trim() || "my child"} can attend both classes, Saturday and Sunday, at this time, and that a parent or guardian will help them join on time.`}
        error={e.timingConsent}
        checked={d.timingConsent}
        onChange={(timingConsent) => set({ timingConsent })}
      />
    </div>
  );
}

/* ── Summer: fee ─────────────────────────────────────────────────────── */

export function SummerFeeStep({
  draft: d,
  set,
  errors: e,
  blur,
  today,
  season,
}: StepProps & { season: { title: string; detail: string } }) {
  const level = summerLevel(d.dob, today);
  return (
    <div className="flex flex-col gap-6">
      <FactCard title={season.title}>{season.detail}</FactCard>
      {level ? (
        <FactCard title={level === "level1" ? "Level 1 (ages 5 to 10)" : "Level 2 (ages 11 to 15)"}>
          {cap(d.firstName.trim() || "Your child")} is placed in this level from the date of birth.
        </FactCard>
      ) : null}
      <RadioCards
        name="summerFee"
        legend="Camp fee"
        error={e.summerFee}
        value={d.summerFee}
        onChange={(summerFee) => set({ summerFee })}
        options={[
          {
            value: "standard",
            label: `Standard fee: ${money(SUMMER_STANDARD_FEE)}`,
            hint: "Paid once for the whole camp, by card on our secure Stripe page.",
          },
          { value: "existing", label: "Existing student", hint: "Current Ilm-Ul-Quran USA students do not pay for the camp." },
          { value: "help", label: "I need help with the fee", hint: "Pay what you can, or ask for a free place. No child is turned away." },
        ]}
      />
      {d.summerFee === "help" ? (
        <div className="flex flex-col gap-6 border-l-2 border-rule pl-4">
          <RadioCards
            name="summerHelp"
            legend="What would you like to do?"
            error={e.summerHelp}
            value={d.summerHelp}
            onChange={(summerHelp) => set({ summerHelp })}
            columns={2}
            options={[
              { value: "amount", label: "Pay what I can" },
              { value: "free", label: "Request a free place" },
            ]}
          />
          {d.summerHelp === "amount" ? (
            <InputField
              name="summerAmount"
              label="Amount you can pay (USD)"
              hint="Paid once for the whole camp. Our team confirms it with you."
              inputMode="decimal"
              maxLength={8}
              value={d.summerAmount}
              onChange={(summerAmount) => set({ summerAmount })}
              onBlur={() => blur("summerAmount")}
              error={e.summerAmount}
              className="max-w-60"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ── Review ──────────────────────────────────────────────────────────── */

export type SummaryGroup = { step: StepId; title: string; rows: [string, string][] };

export function ReviewStep({
  draft: d,
  set,
  errors: e,
  blur,
  groups,
  onEdit,
}: StepProps & { groups: SummaryGroup[]; onEdit: (step: StepId) => void }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <section key={g.title} aria-labelledby={`review-${g.step}`} className="rounded-card border border-rule p-4">
            <div className="flex items-center justify-between gap-4">
              <h2 id={`review-${g.step}`} className="text-body font-medium text-ink">
                {g.title}
              </h2>
              <button
                type="button"
                onClick={() => onEdit(g.step)}
                className="inline-flex min-h-11 items-center px-1 text-ui text-link underline decoration-1 underline-offset-2 hov:decoration-2"
              >
                Edit<span className="sr-only"> {g.title.toLowerCase()}</span>
              </button>
            </div>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-ui sm:grid-cols-[11rem_1fr]">
              {g.rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="text-ink [overflow-wrap:anywhere]">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        <SelectField
          name="referral"
          label="How did you hear about us?"
          placeholder="Choose one"
          value={d.referral}
          onChange={(referral) => set({ referral: referral as Referral })}
          onBlur={() => blur("referral")}
          error={e.referral}
        >
          {REFERRALS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </SelectField>
        {d.referral === "other" ? (
          <InputField
            name="referralOther"
            label="Where did you hear about us?"
            maxLength={100}
            value={d.referralOther}
            onChange={(referralOther) => set({ referralOther })}
            onBlur={() => blur("referralOther")}
            error={e.referralOther}
          />
        ) : null}

        <fieldset className="min-w-0">
          <legend className="text-ui font-medium text-ink">Updates</legend>
          <CheckboxField name="waUpdates" label="Send me news and reminders on WhatsApp" checked={d.waUpdates} onChange={(waUpdates) => set({ waUpdates })} />
          <CheckboxField
            name="futureUpdates"
            label="Email me about future programs"
            checked={d.futureUpdates}
            onChange={(futureUpdates) => set({ futureUpdates })}
          />
          {d.variant === "monthly" ? (
            <CheckboxField
              name="whatsappGroup"
              label="Add me to the parents’ WhatsApp group"
              checked={d.whatsappGroup === "yes"}
              onChange={(v) => set({ whatsappGroup: v ? "yes" : "no" })}
            />
          ) : null}
        </fieldset>

        {d.variant === "summer" ? (
          <RadioCards
            name="whatsappGroup"
            legend="Add you to the camp’s parents’ WhatsApp group?"
            error={e.whatsappGroup}
            value={d.whatsappGroup}
            onChange={(whatsappGroup) => set({ whatsappGroup })}
            columns={2}
            options={[
              { value: "yes", label: "Yes, please" },
              { value: "no", label: "No, thank you" },
            ]}
          />
        ) : null}

        <CheckboxField
          name="terms"
          label={
            <>
              I agree to the{" "}
              <Link href="/legal/terms" className="text-link underline underline-offset-2">
                terms
              </Link>{" "}
              and the{" "}
              <Link href="/legal/privacy" className="text-link underline underline-offset-2">
                privacy policy
              </Link>
              .
            </>
          }
          error={e.terms}
          checked={d.terms}
          onChange={(terms) => set({ terms })}
        />
      </div>
    </div>
  );
}
