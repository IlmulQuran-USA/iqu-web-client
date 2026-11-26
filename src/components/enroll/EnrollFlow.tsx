"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { joinWaitlist, submitEnrollment } from "@/app/actions/enroll";
import { Button, ButtonLink } from "@/components/ui/Button";
import { monthlyCourses } from "@/content/pricing";
import { programTimetables, wallTimeRange } from "@/content/program-timetable";
import { site } from "@/content/site";
import { cn } from "@/lib/cn";
import { afterHelp, money, quoteMonthly, SUMMER_STANDARD_FEE } from "@/lib/enroll/fees";
import { countryName, HELP_LEVELS, labelOf, LANGUAGES, QURAN_LEVELS, TEACHER_PREFS, WEEKDAYS } from "@/lib/enroll/options";
import type { EnrollParams, Variant } from "@/lib/enroll/params";
import {
  ageOn,
  displayDate,
  emptyDraft,
  isRealDate,
  STEPS,
  summerLevel,
  todayIso,
  validateAll,
  validateStep,
  type Draft,
  type Errors,
  type StepId,
} from "@/lib/enroll/schema";
import { clockLabel, detectZone, zoneLabel, zoneShort } from "@/lib/enroll/schedule";
import { instantAt, timeRange } from "@/lib/time-zone";
import { DRAFT_KEY, LAST_KEY, SEED_KEY } from "@/lib/enroll/keys";
import { InlineAlert, InputField } from "./fields";
import { EnrollFooter, EnrollHeader } from "./frame";
import { getRecaptchaToken, loadRecaptcha } from "./recaptcha";
import type { SummaryGroup } from "./later-steps";
import { StudentStep, studentName, type StepProps } from "./steps";

/*
 * Steps 2 to 5 (later-steps.tsx) are not in /enroll's first load: the module
 * starts loading as soon as the page hydrates (loadBrowserInitial), long
 * before anyone finishes step 1, and a draft restored on a later step waits
 * for it, so no step ever shows empty (js-budget, 26 Nov 2026).
 */
type LaterSteps = typeof import("./later-steps");
let laterStepsModule: LaterSteps | null = null;
const loadLaterSteps = () =>
  import("./later-steps").then((mod) => {
    laterStepsModule = mod;
    return mod;
  });

/** The later steps' module once loaded; `failed` when it could not be fetched (offline). */
function useLaterSteps(): { later: LaterSteps | null; failed: boolean; retry: () => void } {
  const [later, setLater] = useState<LaterSteps | null>(laterStepsModule);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (later) return;
    let live = true;
    loadLaterSteps().then(
      (mod) => {
        if (live) setLater(mod);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [later, attempt]);
  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);
  return { later, failed, retry };
}

/*
 * /enroll: one template for monthly courses (5 steps), the Weekend program
 * and the Summer camp (3 steps each). Plan: enroll-shape-plan.md B3 with the
 * owner's decisions of 24 Nov 2026.
 *
 * - Progress is saved on this device after every change (decision 10) and
 *   restored with a notice and "Start over".
 * - Fields are checked on blur (empty fields are not flagged) and the whole
 *   step on Continue, with an error summary that links to each field.
 * - One filled button per view: Continue, or the submit on Review.
 * - Nothing is ever faked: without a connection to WordPress, Review links to
 *   the live form instead of submitting.
 */

type Saved = { draft: Draft; step: number; visited: number };

const HEADINGS: Record<StepId, (d: Draft) => string> = {
  student: (d) => (d.variant === "monthly" ? "Who is learning?" : "About your child"),
  course: () => "Choose a course",
  schedule: (d) => (d.who === "self" ? "When can you attend?" : `When can ${studentName(d)} attend?`),
  fees: () => "Monthly fee",
  weekendSchedule: () => "Class times",
  summerFee: () => "Camp fee",
  review: () => "Check and send",
};

const REASSURANCE: Record<StepId, string> = {
  student: "We never share your details.",
  course: "Live classes, one-on-one or in a small group, with qualified Huffaz, Ulama and Mufti.",
  schedule: "Times are flexible. A teacher is matched to the time you choose.",
  fees: "No child’s place is ever affected by cost.",
  weekendSchedule: "The Weekend Ilm Program is free for every child.",
  summerFee: "No child’s place is ever affected by cost.",
  review: "You can edit any answer before you send it.",
};

const PROGRAM_LABEL: Record<Variant, string> = {
  monthly: "Monthly classes",
  weekend: "Weekend Ilm Program",
  summer: "Summer Ilm Camp",
};

function storageGet(key: string, store: "local" | "session" = "local"): string | null {
  try {
    return (store === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function storageSet(key: string, value: string | null, store: "local" | "session" = "local") {
  try {
    const s = store === "local" ? window.localStorage : window.sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the form still works, it just doesn't remember.
  }
}

function newSubmitId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  }
}

/** Apply ?course= and ?aid=request without overwriting an answer the family already gave. */
function withParams(d: Draft, p: EnrollParams): Draft {
  let next = d;
  if (p.courseId && !next.courseId) {
    const c = monthlyCourses.find((x) => x.id === p.courseId)!;
    next = { ...next, courseId: p.courseId, daysPerWeek: c.minDays === c.maxDays ? c.minDays : next.daysPerWeek };
  }
  if (p.aid && next.variant === "monthly" && !next.feeChoice) next = { ...next, feeChoice: "help" };
  if (p.aid && next.variant === "summer" && !next.summerFee) next = { ...next, summerFee: "help" };
  return next;
}

/* ── Summaries (rail and Review) ─────────────────────────────────────── */

function scheduleText(d: Draft): string {
  if (!d.from || !d.to || !d.timeZone) return "";
  return `${clockLabel(d.from)}–${clockLabel(d.to)} ${zoneShort(d.timeZone)}`;
}

function feeText(d: Draft): string {
  if (d.variant === "weekend") return "Free";
  if (d.variant === "summer") {
    if (d.summerFee === "standard") return `${money(SUMMER_STANDARD_FEE)}, paid once`;
    if (d.summerFee === "existing") return "Existing student (complimentary)";
    if (d.summerFee === "help") return d.summerHelp === "free" ? "Request a free place" : d.summerAmount ? `Pay what I can: $${d.summerAmount.replace(/^\$/, "")}` : "Help with the fee";
    return "";
  }
  const q = d.courseId && d.daysPerWeek ? quoteMonthly(d.courseId, d.daysPerWeek) : null;
  if (!q) return "";
  if (d.feeChoice === "help" && d.helpLevel) {
    const label = labelOf(HELP_LEVELS, d.helpLevel).toLowerCase();
    return `Asking for ${label} (${money(afterHelp(q.full, d.helpLevel))} a month)`;
  }
  if (d.feeChoice === "code" && d.couponApplied) return `Scholarship code: ${money(d.couponApplied.final)} a month`;
  if (d.feeChoice === "pay" && d.special && q.special !== null) return `Special plan: ${money(q.special)} a month`;
  return `${money(q.full)} a month`;
}

function reviewGroups(d: Draft, today: string): SummaryGroup[] {
  const phone = (c: string, n: string) => (n ? `${c === "OTHER" ? "" : "+1 "}${n}` : "");
  const age = isRealDate(d.dob) && d.dob <= today ? ` (age ${ageOn(d.dob, today)})` : "";
  const student: SummaryGroup = {
    step: "student",
    title: d.who === "self" ? "About you" : "Student",
    rows: [
      ["Name", `${d.firstName} ${d.lastName}`.trim()],
      ["Date of birth", d.dob ? `${displayDate(d.dob)}${age}` : ""],
      ...(d.guardianName ? ([["Parent or guardian", d.guardianName]] as [string, string][]) : []),
      ["Email", d.email],
      [d.variant === "summer" ? "Phone" : "WhatsApp", phone(d.phoneCountry, d.phone)],
      ...(d.variant === "summer" && !d.whatsappSame ? ([["WhatsApp", phone(d.whatsappCountry, d.whatsapp)]] as [string, string][]) : []),
      ["Lives in", countryName(d.residence)],
      ["Country of origin", countryName(d.origin)],
      ...(d.variant === "monthly"
        ? ([
            [
              "Languages",
              d.languages
                .map((l) => (l === "other" ? d.languagesOther : labelOf(LANGUAGES, l)))
                .filter(Boolean)
                .join(", "),
            ],
          ] as [string, string][])
        : []),
      ...(d.variant !== "summer" ? ([["Current student", d.existing === "yes" ? "Yes" : d.existing === "no" ? "No" : ""]] as [string, string][]) : []),
    ],
  };
  if (d.variant === "weekend") {
    return [
      student,
      { step: "weekendSchedule", title: "Schedule", rows: [["Classes", "Saturday and Sunday, 10–11 AM CT"], ["Time zone", zoneLabel(d.timeZone)], ["Timing confirmed", d.timingConsent ? "Yes" : "No"]] },
    ];
  }
  if (d.variant === "summer") {
    const level = summerLevel(d.dob, today);
    return [
      student,
      {
        step: "summerFee",
        title: "Camp",
        rows: [
          ["Level", level === "level1" ? "Level 1 (ages 5 to 10)" : level === "level2" ? "Level 2 (ages 11 to 15)" : ""],
          ["Fee", feeText(d)],
        ],
      },
    ];
  }
  const course = monthlyCourses.find((c) => c.id === d.courseId);
  const days = WEEKDAYS.filter((w) => d.days.includes(w.value)).map((w) => w.short).join(", ");
  return [
    student,
    {
      step: "course",
      title: "Course",
      rows: [
        ["Course", course?.label ?? ""],
        ["Level", labelOf(QURAN_LEVELS, d.quranLevel)],
        ["Memorized so far", d.memorized],
        ["Teacher", labelOf(TEACHER_PREFS, d.teacherPref)],
      ],
    },
    {
      step: "schedule",
      title: "Schedule",
      rows: [
        ["Days a week", d.daysPerWeek ? String(d.daysPerWeek) : ""],
        ["Preferred days", days],
        ["Free between", scheduleText(d)],
        ["Class length", d.classLength ? `${d.classLength} minutes` : ""],
        ["Time zone", d.timeZone ? zoneLabel(d.timeZone) : ""],
      ],
    },
    { step: "fees", title: "Fee", rows: [["Fee", feeText(d)], ...(d.feeChoice === "help" && d.helpNote ? ([["Your note", d.helpNote]] as [string, string][]) : [])] },
  ];
}

function railRows(d: Draft, today: string): [string, string][] {
  const name = `${d.firstName} ${d.lastName}`.trim();
  const age = isRealDate(d.dob) && d.dob <= today ? `age ${ageOn(d.dob, today)}` : "";
  const rows: [string, string][] = [
    ["Program", PROGRAM_LABEL[d.variant]],
    ["Student", [name, age].filter(Boolean).join(", ")],
  ];
  if (d.variant === "monthly") {
    rows.push(["Course", monthlyCourses.find((c) => c.id === d.courseId)?.label ?? ""]);
    const days = WEEKDAYS.filter((w) => d.days.includes(w.value)).map((w) => w.short).join(", ");
    rows.push(["Days", [d.daysPerWeek ? `${d.daysPerWeek} a week` : "", days].filter(Boolean).join(" · ")]);
    rows.push(["Time", [scheduleText(d), d.classLength ? `${d.classLength}-minute classes` : ""].filter(Boolean).join(" · ")]);
  }
  if (d.variant === "weekend") rows.push(["Classes", "Sat and Sun, 10–11 AM CT"]);
  if (d.variant === "summer") {
    const level = summerLevel(d.dob, today);
    rows.push(["Level", level === "level1" ? "Level 1" : level === "level2" ? "Level 2" : ""]);
  }
  rows.push(["Fee", feeText(d)]);
  return rows;
}

function submitLabel(d: Draft): string {
  // Owner decision 9: route-aware labels, never "free trial".
  if (d.variant === "weekend") return "Enroll in the Weekend program";
  if (d.variant === "summer") return d.summerFee === "standard" ? "Continue to payment" : "Send my enrollment";
  return d.existing === "yes" || d.feeChoice !== "pay" ? "Send my enrollment" : "Continue to card setup";
}

/** Weekend class time at home (CT) and in the family's zone, for the next Saturday. */
function weekendTimeLine(zone: string): { home: string; local: string | null } {
  const t = programTimetables["weekend-ilm-program"];
  const home = `${wallTimeRange(t.start, t.end)} ${t.zoneLabel}`;
  if (!zone || zoneShort(zone) === t.zoneLabel) return { home, local: null };
  const now = new Date();
  const sat = new Date(now.getTime() + ((6 - now.getUTCDay() + 7) % 7) * 86_400_000);
  const from = instantAt(t.zone, t.start, sat);
  const to = instantAt(t.zone, t.end, sat);
  return { home, local: `${timeRange(from, to, zone)} ${zoneShort(zone)}` };
}

/* ── The flow ────────────────────────────────────────────────────────── */

type FlowProps = {
  params: EnrollParams;
  connected: boolean;
  siteKey: string | null;
  liveFormUrl: string;
  /** Summer only: the season line for the fee step. */
  season?: { title: string; detail: string };
};

type Initial = {
  draft: Draft;
  step: number;
  visited: number;
  restored: boolean;
  zoneDetected: boolean;
  usedSeed: boolean;
  today: string;
  /**
   * True when this device has a saved draft that could not be checked (the
   * schema failed to load): the form starts fresh but never autosaves, so
   * the saved draft is still there on the next visit.
   */
  keepSaved?: boolean;
};

/** On the server and during hydration: an empty form for this template. */
function serverInitial(params: EnrollParams): Initial {
  return {
    draft: withParams(emptyDraft(params.variant, ""), params),
    step: 0,
    visited: 0,
    restored: false,
    zoneDetected: false,
    usedSeed: false,
    today: todayIso(),
  };
}

type DraftSchema = (typeof import("@/lib/enroll/draft-schema"))["draftSchema"];

/**
 * In the browser: the saved draft, or a new one (with the sibling seed and
 * the device's time zone). Reads only. `schema` checks what this device
 * saved; without it nothing saved is used.
 */
function browserInitial(params: EnrollParams, schema: DraftSchema | null): Initial {
  const variant = params.variant;
  const last = STEPS[variant].length - 1;
  const saved = schema ? storageGet(DRAFT_KEY(variant)) : null;
  if (saved && schema) {
    try {
      const parsed = JSON.parse(saved) as Saved;
      const ok = schema.safeParse(parsed.draft);
      if (ok.success && ok.data.variant === variant && ok.data.submitId) {
        const step = Math.max(0, Math.min(parsed.step | 0, last));
        return {
          draft: withParams(ok.data, params),
          step,
          visited: Math.max(step, Math.min(parsed.visited | 0, last)),
          restored: true,
          zoneDetected: false,
          usedSeed: false,
          today: todayIso(),
        };
      }
    } catch {
      // A damaged save is ignored.
    }
  }
  let draft = withParams(emptyDraft(variant, newSubmitId()), params);
  let usedSeed = false;
  const seed = schema ? storageGet(SEED_KEY) : null;
  if (seed && schema) {
    try {
      const s = JSON.parse(seed) as Partial<Draft>;
      const keep = ["guardianName", "email", "phoneCountry", "phone", "residence", "origin", "languages", "languagesOther", "timeZone"] as const;
      const pick = Object.fromEntries(keep.filter((k) => s[k] !== undefined).map((k) => [k, s[k]]));
      const merged = schema.safeParse({ ...draft, ...pick, who: "child" });
      if (merged.success) {
        draft = merged.data;
        usedSeed = true;
      }
    } catch {
      // A damaged seed is ignored.
    }
  }
  let zoneDetected = false;
  if (!draft.timeZone) {
    const zone = detectZone();
    if (zone) {
      draft = { ...draft, timeZone: zone };
      zoneDetected = true;
    }
  }
  return { draft, step: 0, visited: 0, restored: false, zoneDetected, usedSeed, today: todayIso() };
}

/**
 * The browser's starting point. The draft schema (zod) is fetched only when
 * this device has a saved draft or a sibling seed to check, so zod stays out
 * of /enroll's first load (about 17 KB gz; js-budget, 26 Nov 2026). If it
 * cannot be fetched (tried twice), the form starts fresh and leaves the saved
 * draft untouched (keepSaved).
 */
async function loadBrowserInitial(params: EnrollParams): Promise<Initial> {
  // Steps 2 to 5 start loading now, with nothing waiting on them yet.
  const laterSteps = loadLaterSteps();
  laterSteps.catch(() => undefined);
  const hasSaved = storageGet(DRAFT_KEY(params.variant)) !== null || storageGet(SEED_KEY) !== null;
  let initial: Initial;
  if (!hasSaved) initial = browserInitial(params, null);
  else {
    const loadSchema = () => import("@/lib/enroll/draft-schema").then((mod) => mod.draftSchema);
    const schema = await loadSchema()
      .catch(loadSchema)
      .catch(() => null);
    initial = schema ? browserInitial(params, schema) : { ...browserInitial(params, null), keepSaved: true };
  }
  // A draft saved on a later step opens there: wait for that step's code first.
  if (initial.step > 0) await laterSteps.catch(() => undefined);
  return initial;
}

/**
 * Renders the empty form on the server and during hydration, then remounts
 * once in the browser with what this device saved. Until then the form is
 * the server's (hydrated false): nothing is autosaved, so a saved draft can
 * never be overwritten by an empty one while the schema is on its way.
 */
export function EnrollFlow(props: FlowProps) {
  const [browser, setBrowser] = useState<Initial | null>(null);
  useEffect(() => {
    let live = true;
    void loadBrowserInitial(props.params).then((next) => {
      if (live) setBrowser(next);
    });
    return () => {
      live = false;
    };
  }, [props.params]);
  const initial = useMemo(() => browser ?? serverInitial(props.params), [browser, props.params]);
  return <Flow key={browser ? "browser" : "server"} {...props} initial={initial} hydrated={browser !== null} />;
}

function Flow({ params, connected, siteKey, liveFormUrl, season, initial, hydrated }: FlowProps & { initial: Initial; hydrated: boolean }) {
  const variant = params.variant;
  const steps = STEPS[variant];
  const router = useRouter();

  const [draft, setDraft] = useState<Draft>(initial.draft);
  const [step, setStep] = useState(initial.step);
  const [visited, setVisited] = useState(initial.visited);
  const [errors, setErrors] = useState<Errors>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [restored, setRestored] = useState(initial.restored);
  const [mountKey, setMountKey] = useState(0);
  const [returnToReview, setReturnToReview] = useState(false);
  const [zoneDetected, setZoneDetected] = useState(initial.zoneDetected);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ message: string; country: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const today = initial.today;
  const honeypot = useRef<HTMLInputElement>(null);
  // Set once the plugin accepted the enrollment: nothing is saved again, even if a Back navigation shows this form.
  const submitted = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  // The latest draft for event handlers; every change goes through set().
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const stepId = steps[Math.min(step, steps.length - 1)].id;

  // The sibling seed is used once.
  useEffect(() => {
    if (initial.usedSeed) storageSet(SEED_KEY, null);
  }, [initial.usedSeed]);

  // Autosave on every change (decision 10).
  useEffect(() => {
    if (!hydrated || initial.keepSaved || redirecting || submitted.current) return;
    storageSet(DRAFT_KEY(variant), JSON.stringify({ draft, step, visited } satisfies Saved));
  }, [draft, step, visited, hydrated, initial.keepSaved, variant, redirecting]);

  // Warm up reCAPTCHA on Review so the submit is quick.
  useEffect(() => {
    if (stepId === "review" && connected && siteKey) loadRecaptcha(siteKey).catch(() => undefined);
  }, [stepId, connected, siteKey]);

  const set = useCallback(
    (patch: Partial<Draft>) => {
      const next = { ...draftRef.current, ...patch };
      draftRef.current = next;
      setDraft(next);
      // A field already in error is re-checked as soon as it changes (radios and boxes have no blur).
      setErrors((prev) => {
        const keys = Object.keys(patch).filter((k) => prev[k]);
        if (keys.length === 0) return prev;
        const fresh = validateStep(next, stepId, today);
        const out = { ...prev };
        for (const k of keys) out[k] = fresh[k];
        return out;
      });
      if (patch.timeZone !== undefined) setZoneDetected(false);
    },
    [stepId, today],
  );

  const blur = useCallback(
    (field: string) => {
      const d = draftRef.current;
      const value = (d as Record<string, unknown>)[field];
      const fresh = validateStep(d, stepId, today);
      setErrors((prev) => {
        // An empty field is not flagged on blur; Continue still checks it.
        if (typeof value === "string" && !value.trim() && !prev[field]) return prev;
        return { ...prev, [field]: fresh[field] };
      });
    },
    [stepId, today],
  );

  // Focus moves after React has committed the new step or the error summary.
  const [focusTarget, setFocusTarget] = useState<{ to: "heading" | "summary"; n: number } | null>(null);
  useEffect(() => {
    if (!focusTarget) return;
    if (focusTarget.to === "summary" && summaryRef.current) {
      summaryRef.current.scrollIntoView({ block: "start" });
      summaryRef.current.focus({ preventScroll: true });
    } else if (focusTarget.to === "heading") {
      window.scrollTo({ top: 0, behavior: "auto" });
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [focusTarget]);

  function focusHeading() {
    setFocusTarget((f) => ({ to: "heading", n: (f?.n ?? 0) + 1 }));
  }

  function showErrors(next: Errors, message: string) {
    setErrors(next);
    setSummary(message);
    setFocusTarget((f) => ({ to: "summary", n: (f?.n ?? 0) + 1 }));
  }

  function goTo(index: number) {
    setErrors({});
    setSummary(null);
    setSendError(null);
    setRestored(false);
    setStep(index);
    setVisited((v) => Math.max(v, index));
    focusHeading();
  }

  function onContinue() {
    const errs = validateStep(draft, stepId, today);
    if (Object.keys(errs).length > 0) {
      showErrors(errs, "Some answers need another look.");
      return;
    }
    const last = steps.length - 1;
    goTo(returnToReview ? last : Math.min(step + 1, last));
    setReturnToReview(false);
  }

  function onEdit(target: StepId) {
    setReturnToReview(true);
    goTo(steps.findIndex((s) => s.id === target));
  }

  function startOver() {
    storageSet(DRAFT_KEY(variant), null);
    const fresh = withParams(emptyDraft(variant, newSubmitId()), params);
    const zone = detectZone();
    setDraft(zone ? { ...fresh, timeZone: zone } : fresh);
    setZoneDetected(Boolean(zone));
    setRestored(false);
    setConfirmReset(false);
    setReturnToReview(false);
    setMountKey((k) => k + 1);
    goTo(0);
    setVisited(0);
  }

  function rememberForConfirmation(d: Draft) {
    const course = monthlyCourses.find((c) => c.id === d.courseId);
    storageSet(
      LAST_KEY,
      JSON.stringify({
        name: d.who === "self" ? "" : d.firstName.trim(),
        variant: d.variant,
        course: course?.label ?? "",
        courseId: d.courseId,
        schedule: scheduleText(d),
        seed: {
          guardianName: d.who === "self" ? `${d.firstName} ${d.lastName}`.trim() : d.guardianName,
          email: d.email,
          phoneCountry: d.phoneCountry,
          phone: d.phone,
          residence: d.residence,
          origin: d.origin,
          languages: d.languages,
          languagesOther: d.languagesOther,
          timeZone: d.timeZone,
        },
      }),
      "session",
    );
  }

  async function onSubmit() {
    if (sending) return;
    setSendError(null);
    const problems = validateAll(draft, today);
    if (problems) {
      const index = steps.findIndex((s) => s.id === problems.step);
      if (index !== step) {
        setStep(index);
        setReturnToReview(true);
      }
      showErrors(problems.errors, "Some answers need another look before you send.");
      return;
    }
    if (!connected || !siteKey) return;
    setSending(true);
    try {
      let token = "";
      try {
        token = await getRecaptchaToken(siteKey, { monthly: "iqu_free_form", weekend: "iqu_weekend_form", summer: "iqu_summer_form" }[variant]);
      } catch {
        setSendError("We couldn’t load the security check. Please check your connection and try again.");
        return;
      }
      const result = await submitEnrollment(draft, token, honeypot.current?.value ?? "");
      if (result.status === "ok") {
        submitted.current = true;
        rememberForConfirmation(draft);
        storageSet(DRAFT_KEY(variant), null);
        if (result.external) {
          setRedirecting(result.href);
          window.location.assign(result.href);
        } else {
          router.push(result.href);
        }
        return;
      }
      if (result.status === "invalid") {
        const index = steps.findIndex((s) => s.id === result.step);
        if (index >= 0 && index !== step) {
          setStep(index);
          setReturnToReview(true);
        }
        showErrors(result.errors, result.message);
        return;
      }
      if (result.status === "blocked") {
        setBlocked({ message: result.message, country: result.country });
        return;
      }
      if (result.status === "not_connected") {
        setSendError("Online enrollment on this page opens soon. For now, please enroll on our current form.");
        return;
      }
      setSendError(result.message);
    } catch {
      setSendError("We couldn’t reach our enrollment system. Your answers are saved on this device. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const errorList = Object.entries(errors).filter(([, m]) => m) as [string, string][];
  const props: StepProps = { draft, set, errors, blur, today, connected, siteKey, zoneDetected, hydrated };
  const { later, failed: laterFailed, retry: retryLater } = useLaterSteps();
  const isReview = stepId === "review";

  if (redirecting) {
    return (
      <main id="main-content" className="container-content flex flex-1 flex-col items-center justify-center py-16 text-center">
        <h1 className="font-display text-heading-lg font-semibold text-ink" tabIndex={-1}>
          Taking you to our secure payment page…
        </h1>
        <p className="mt-3 max-w-measure text-body text-ink-body">Stripe keeps your card or bank details. We never see them.</p>
        <a href={redirecting} className="mt-6 inline-flex min-h-11 items-center text-body text-link underline underline-offset-2">
          Continue to the payment page
        </a>
      </main>
    );
  }

  return (
    <>
      <EnrollHeader>
        <span>
          <span className="hidden sm:inline">{PROGRAM_LABEL[variant]} · </span>Step {step + 1} of {steps.length}
        </span>
        {/* Not while keepSaved: this session's answers are not being saved. */}
        {hydrated && !initial.keepSaved ? <span aria-hidden="true">·</span> : null}
        {hydrated && !initial.keepSaved ? (
          <span>
            <span className="sm:hidden">Saved</span>
            <span className="hidden sm:inline">Saved on this device</span>
          </span>
        ) : null}
      </EnrollHeader>

      <main id="main-content" className="flex-1 pb-28 lg:pb-16">
        <div className="container-content">
          <nav aria-label="Enrollment steps" className="pt-6">
            <ol className="flex flex-wrap gap-x-1 gap-y-2">
              {steps.map((s, i) => {
                const current = i === step;
                const reachable = i <= visited && !current;
                return (
                  <li key={s.id} className="flex items-center">
                    {reachable ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReturnToReview(false);
                          goTo(i);
                        }}
                        className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-chip px-2 text-ui text-ink underline decoration-rule underline-offset-4 hov:decoration-ink"
                      >
                        <StepDot n={i + 1} state="done" />
                        <span className="max-sm:sr-only">{s.label}</span>
                      </button>
                    ) : (
                      <span
                        aria-current={current ? "step" : undefined}
                        className={cn("inline-flex min-h-11 items-center gap-2 px-2 text-ui", current ? "font-medium text-ink" : "text-ink-muted")}
                      >
                        <StepDot n={i + 1} state={current ? "current" : "todo"} />
                        <span className={current ? undefined : "max-sm:sr-only"}>{s.label}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="mt-2 h-1 overflow-hidden rounded-pill bg-surface" aria-hidden="true">
              <div className="h-full bg-ink transition-[width] duration-(--duration-default) ease-riwaq" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
            </div>
          </nav>

          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 max-w-form">
              <h1 ref={headingRef} tabIndex={-1} className="font-display text-heading-xl font-semibold text-balance text-ink">
                {HEADINGS[stepId](draft)}
              </h1>
              {/* On phones the side summary is collapsed, so the step's reassurance sits under the heading. */}
              <p className="mt-2 text-body text-ink-body lg:hidden">{REASSURANCE[stepId]}</p>

              {restored ? (
                <InlineAlert className="mt-6" title="We saved your progress on this device.">
                  {confirmReset ? (
                    <span className="flex flex-wrap items-center gap-x-4">
                      <span className="text-ink">Clear all answers?</span>
                      <button type="button" onClick={startOver} className="inline-flex min-h-11 items-center text-link underline underline-offset-2">
                        Yes, start over
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="inline-flex min-h-11 items-center text-link underline underline-offset-2"
                      >
                        Keep my answers
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="inline-flex min-h-11 items-center text-link underline underline-offset-2"
                    >
                      Start over
                    </button>
                  )}
                </InlineAlert>
              ) : null}

              <details className="mt-6 rounded-card border border-rule lg:hidden">
                <summary className="flex min-h-11 cursor-pointer items-center px-4 text-ui font-medium text-ink">Your answers so far</summary>
                <RailContent rows={railRows(draft, today)} note={REASSURANCE[stepId]} />
              </details>

              {summary && errorList.length > 0 ? (
                <div ref={summaryRef} tabIndex={-1} role="alert" className="mt-6 rounded-card border-2 border-danger p-4">
                  <h2 className="text-body font-medium text-ink">{summary}</h2>
                  <ul className="mt-2 list-disc pl-5 text-ui">
                    {errorList.map(([field, message]) => (
                      <li key={field}>
                        <a href={`#enroll-${field}`} className="inline-flex min-h-11 items-center text-danger underline underline-offset-2">
                          {message}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <form
                className="mt-8"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  if (isReview) void onSubmit();
                  else onContinue();
                }}
              >
                <div key={`${stepId}-${mountKey}`}>
                  {stepId === "student" ? <StudentStep {...props} /> : null}
                  {later && stepId === "course" ? <later.CourseStep {...props} /> : null}
                  {later && stepId === "schedule" ? <later.ScheduleStep {...props} /> : null}
                  {later && stepId === "fees" ? <later.FeesStep {...props} /> : null}
                  {later && stepId === "weekendSchedule" ? <later.WeekendScheduleStep {...props} timeLine={weekendTimeLine} /> : null}
                  {later && stepId === "summerFee" && season ? <later.SummerFeeStep {...props} season={season} /> : null}
                  {later && stepId === "review" ? <later.ReviewStep {...props} groups={reviewGroups(draft, today)} onEdit={onEdit} /> : null}
                  {/* Only if this step's code has not arrived yet (it starts loading on page load): a very slow or lost connection. */}
                  {!later && stepId !== "student" ? (
                    laterFailed ? (
                      <div role="alert">
                        <InlineAlert tone="warning" title="This step could not load">
                          <p>Check your connection, then try again.</p>
                          <Button variant="secondary" className="mt-3" onClick={retryLater}>
                            Try again
                          </Button>
                        </InlineAlert>
                      </div>
                    ) : (
                      <p role="status" className="text-ui text-ink-muted">
                        Loading this step…
                      </p>
                    )
                  ) : null}
                </div>

                {/* Honeypot: hidden from people and from assistive tech; bots fill it. */}
                <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                  <label htmlFor="enroll-website">Leave this empty</label>
                  <input ref={honeypot} id="enroll-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
                </div>

                {isReview ? (
                  <div className="mt-8 flex flex-col gap-4">
                    {!connected ? (
                      <InlineAlert tone="info" title="Online enrollment on this page opens soon.">
                        For now, please enroll on our current form. Your answers stay saved on this device.
                      </InlineAlert>
                    ) : null}
                    {sendError ? (
                      <div role="alert">
                        <InlineAlert tone="danger" title="Not sent yet">
                          {sendError}
                        </InlineAlert>
                      </div>
                    ) : null}
                    <p className="text-ui text-ink-muted">
                      Your information is kept private and used only to arrange classes. This form is protected by reCAPTCHA.
                    </p>
                  </div>
                ) : null}

                <div className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-paper/95 py-3 backdrop-blur-sm lg:static lg:mt-10 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
                  <div className="container-content flex items-center justify-between gap-3 lg:max-w-none lg:px-0">
                    {step > 0 ? (
                      <Button variant="secondary" onClick={() => goTo(step - 1)}>
                        Back
                      </Button>
                    ) : (
                      <span />
                    )}
                    {isReview ? (
                      connected ? (
                        <Button type="submit" loading={sending} loadingLabel="Sending your enrollment" className="flex-1 sm:flex-none">
                          {submitLabel(draft)}
                        </Button>
                      ) : (
                        <ButtonLink href={liveFormUrl} className="flex-1 sm:flex-none" iconEnd={<ExternalLink aria-hidden="true" strokeWidth={1.5} className="size-4" />}>
                          Go to our current form
                        </ButtonLink>
                      )
                    ) : (
                      <Button type="submit" className="flex-1 sm:flex-none">
                        {returnToReview ? "Back to review" : "Continue"}
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <aside aria-label="Your answers so far" className="hidden lg:block">
              <div className="sticky top-6 rounded-card border border-rule bg-paper">
                <p className="px-4 pt-4 text-ui font-medium text-ink">Your answers so far</p>
                <RailContent rows={railRows(draft, today)} note={REASSURANCE[stepId]} />
              </div>
            </aside>
          </div>
        </div>
      </main>

      <EnrollFooter />

      {blocked ? <WaitlistDialog draft={draft} siteKey={siteKey} blocked={blocked} onClose={() => setBlocked(null)} /> : null}
    </>
  );
}

function StepDot({ n, state }: { n: number; state: "done" | "current" | "todo" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-pill text-ui-xs font-medium",
        state === "current" && "bg-ink text-paper",
        state === "done" && "bg-surface text-ink",
        state === "todo" && "border border-rule text-ink-muted",
      )}
    >
      {n}
    </span>
  );
}

function RailContent({ rows, note }: { rows: [string, string][]; note: string }) {
  const filled = rows.filter(([, v]) => v);
  return (
    <div className="px-4 pt-2 pb-4">
      {filled.length ? (
        <dl className="flex flex-col gap-2 text-ui">
          {filled.map(([k, v]) => (
            <div key={k}>
              <dt className="text-ink-muted">{k}</dt>
              <dd className="text-ink [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-ui text-ink-muted">Your choices appear here as you go.</p>
      )}
      <p className="mt-4 border-t border-rule pt-4 text-ui text-ink-body">{note}</p>
    </div>
  );
}

/* ── Waitlist (outside the US and Canada; the plugin's enforce mode) ──── */

function WaitlistDialog({
  draft,
  siteKey,
  blocked,
  onClose,
}: {
  draft: Draft;
  siteKey: string | null;
  blocked: { message: string; country: string };
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState(draft.email);
  const [name, setName] = useState(draft.guardianName || draft.firstName);
  const [state, setState] = useState<{ busy: boolean; done: string; error: string }>({ busy: false, done: "", error: "" });

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  async function join() {
    if (!siteKey) return;
    setState({ busy: true, done: "", error: "" });
    try {
      const token = await getRecaptchaToken(siteKey, "iqu_waitlist");
      const res = await joinWaitlist({ email, name, program: draft.variant, country: blocked.country, recaptchaToken: token });
      setState({ busy: false, done: res.status === "ok" ? res.message : "", error: res.status === "error" ? res.message : res.status === "not_connected" ? "Please try again later." : "" });
    } catch {
      setState({ busy: false, done: "", error: "No response from the server. Please try again." });
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="waitlist-title"
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-card bg-paper p-6 text-ink shadow-overlay backdrop:bg-(--scrim)"
    >
      <h2 id="waitlist-title" className="font-display text-heading-md font-semibold">
        We are not in your country yet
      </h2>
      <p className="mt-2 text-body text-ink-body">{blocked.message}</p>
      {state.done ? (
        <p role="status" className="mt-4 text-body text-ink">
          {state.done}
        </p>
      ) : (
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
        >
          <InputField name="waitlistEmail" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} maxLength={191} />
          <InputField name="waitlistName" label="Name" optional autoComplete="name" value={name} onChange={setName} maxLength={100} />
          {state.error ? <InlineAlert tone="danger">{state.error}</InlineAlert> : null}
          <Button type="submit" loading={state.busy} loadingLabel="Sending">
            Email me when classes open
          </Button>
        </form>
      )}
      <p className="mt-4 text-ui text-ink-muted">
        Live in the US or Canada and travelling right now?{" "}
        {site.email ? (
          <a href={`mailto:${site.email}`} className="text-link underline underline-offset-2">
            Email us
          </a>
        ) : null}
        {site.phone ? (
          <>
            {" "}
            or call{" "}
            <a href={site.phone.href} className="text-link underline underline-offset-2">
              {site.phone.display}
            </a>
          </>
        ) : null}
        .
      </p>
      <Button variant="secondary" className="mt-4" onClick={() => ref.current?.close()}>
        Close
      </Button>
    </dialog>
  );
}
