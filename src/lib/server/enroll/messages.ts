import { courseById, type CourseId } from "../../../content/pricing.ts";
import { site } from "../../../content/site.ts";
import { HELP_LEVELS, LANGUAGES, labelOf, QURAN_LEVELS, REFERRALS, TEACHER_PREFS, WEEKDAYS } from "../../enroll/options.ts";
import type { Program, RegistrationInsert } from "../../enroll/record.ts";
import { programLabel } from "../../enroll/record.ts";
import { displayDate } from "../../enroll/schema.ts";
import { formatUsd } from "../../money.ts";
import type { ReasonRow, Route } from "./route.ts";

/*
 * What the team and the family are told (architecture §3; plan A1, A4, A5,
 * N8, N11, N12, N19; owner decisions 12, 13, 19 and 24).
 *
 * Telegram: the plugin's message (IQU_Telegram::compose, class-iqu-telegram.php:133-160,
 * rows from IQU_Reg_Fields::admin_rows, class-iqu-reg-fields.php:99-303, titles from
 * class-iqu-notifier.php:273-283), sent AFTER routing with the route, the status
 * and the review reasons (N8), the course variant and the zone label (decision 24),
 * and a time that says "Dhaka time" (N19).
 *
 * Emails: route-aware and truthful (N11): a review is "we received", never
 * "confirmed"; the card route says "add your card"; Summer shows the amount
 * due, never "paid" before Stripe confirms. Quran spelling and the hadith
 * with Arabic and its citation (N12, decision 19).
 */

export type Snapshot = RegistrationInsert & { id: number; couponCode?: string | null };

const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** "25 Nov 2026, 9:05 PM Dhaka time" (N19; CLAUDE.md date style). */
export function dhakaTime(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()} Dhaka time`;
}

const REASON_LABELS: Record<string, string> = {
  help: "Zakat / help with the fee",
  aid_request: "Help with the fee requested",
  existing_student: "Existing student",
  sibling: "Email already has billing",
  location: "Location",
  card_country: "Card country",
  payment_setup: "Card step failed",
  amount: "Amount",
  existing_unknown: "Ask: already a student?",
  coupon_used_up: "Coupon was already used up",
};

export function reasonsText(reasons: ReasonRow[]): string {
  return reasons.map((r) => `${REASON_LABELS[r.reason] ?? r.reason}${r.detail ? ` (${r.detail})` : ""}`).join(", ");
}

const ROUTE_LABELS: Record<Route, string> = {
  card: "Card step",
  review: "Team review (no card)",
  aid: "Help with the fee (no card)",
  details: "Details-only update",
  weekend: "Weekend (free)",
  summer_pay: "Summer payment",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  card_pending: "Card pending",
  pending_review: "Pending review",
};

const usd2 = (c: number | null | undefined) => `$${((c ?? 0) / 100).toFixed(2)}`;
const list = (values: readonly string[] | null | undefined, options: readonly { value: string; label: string }[]) =>
  (values ?? []).map((v) => labelOf(options, v) || v).join(", ");
const weekdays = (values: readonly string[] | null | undefined) => (values ?? []).map((v) => WEEKDAYS.find((d) => d.value === v)?.label ?? v).join(", ");

function courseLabel(variant: string | null | undefined): string {
  if (!variant) return "";
  try {
    return courseById(variant as CourseId).label.replace(/ /g, " ");
  } catch {
    return variant;
  }
}

function summerFeeLabel(s: Snapshot): string {
  if (s.admissionFee === "standard") return `Standard: ${formatUsd(s.paymentCents ?? 0)}`;
  if (s.admissionFee === "complimentary") return "Existing student: complimentary";
  if (s.admissionFee === "flexible") return "I need help with the fee";
  return s.admissionFee ?? "";
}

export type Row = [label: string, value: string];

/** The rows the team sees, per program (admin_rows, RF:99-303, plus N1–N4 fields). */
export function adminRows(s: Snapshot): Row[] {
  const rows: Row[] = [
    ["Participant", `${s.firstName} ${s.lastName}`.trim()],
    ["Email", s.email],
  ];
  const age = s.ageAtSignup !== null && s.ageAtSignup !== undefined ? String(s.ageAtSignup) : "";
  const dob = s.dateOfBirth ? displayDate(s.dateOfBirth) : "";
  const heard = s.referral === "other" && s.referralOther ? `Other: ${s.referralOther}` : labelOf(REFERRALS, s.referral ?? "");

  if (s.program === "weekend_new" || s.program === "weekend_existing") {
    rows.push(
      ["Student Status", s.program === "weekend_new" ? "🆕 New student" : "✅ Existing student"],
      ["Age", age],
      ["Date of Birth", dob],
      ["Guardian", s.guardianName ?? ""],
      ["WhatsApp", s.whatsappE164 ?? ""],
      ["Country of Origin", s.countryOriginName ?? ""],
      ["Country of Residence", s.countryResName ?? ""],
      ["Family time zone", s.timeZone ? `${s.timeZone} (${s.timeZoneLabel ?? ""})` : ""],
      ["Timing consent", s.timingConsentAt ? "✅ Both classes, Sat & Sun 10–11 AM CT" : "⚠️ NOT confirmed"],
      ["Heard About Us Via", heard],
      ["Tuition", "Fully free, nothing to pay"],
    );
    return rows;
  }

  if (s.program === "summer_l1" || s.program === "summer_l2") {
    rows.push(
      ["Age", age],
      ["Date of Birth", dob],
      ["Enrollment Level", s.program === "summer_l1" ? "LEVEL 1" : "LEVEL 2"],
      ["Country of Origin", s.countryOriginName ?? ""],
      ["Country of Residence", s.countryResName ?? ""],
      ["Guardian", s.guardianName ?? ""],
      ["Guardian Contact", s.guardianContactE164 ?? ""],
      ["Guardian WhatsApp", s.guardianWhatsappE164 ?? ""],
      ["Join WhatsApp Group", s.whatsappGroup === "yes" ? "Yes" : s.whatsappGroup === "no" ? "No" : ""],
      ["Heard About Us Via", heard],
      ["Admission Fee", summerFeeLabel(s)],
      ["Flexible / Free Note", s.flexibleFeeNote ?? ""],
      ["Payment Amount", (s.paymentCents ?? 0) > 0 ? usd2(s.paymentCents) : ""],
      ["Payment Status", s.paymentStatus ? s.paymentStatus.replace(/_/g, " ") : ""],
    );
    return rows;
  }

  const languages = [list(s.languages?.filter((l) => l !== "other"), LANGUAGES), s.languagesOther ? `Other: ${s.languagesOther}` : ""]
    .filter(Boolean)
    .join(", ");
  const quranLevel = labelOf(QURAN_LEVELS, s.quranLevel ?? "") || (s.quranLevel ? s.quranLevel[0].toUpperCase() + s.quranLevel.slice(1) : "");
  rows.push(
    ["Age", age],
    ["Date of Birth", dob],
    ["Parent / Guardian", s.guardianName ?? ""],
    ["Country of Origin", s.countryOriginName ?? ""],
    ["Country of Residence", s.countryResName ?? ""],
    ["WhatsApp", s.whatsappE164 ?? ""],
    ["Languages", languages],
    ["Already a student", s.existingStudent === true ? "Yes" : s.existingStudent === false ? "No" : "Not asked"],
    ["Quran Level", quranLevel],
    ["Memorized Before", s.memorized?.trim() || "No"],
    ["Course", courseLabel(s.courseVariant)],
    ["Course variant", s.courseVariant ?? ""],
    ["Classes / Week", s.daysPerWeek ? String(s.daysPerWeek) : ""],
  );
  if (s.perClassCents && s.daysPerWeek) rows.push(["Rate Breakdown", `${s.daysPerWeek * 4} classes/month × ${usd2(s.perClassCents)} per class`]);
  rows.push(["Regular Tuition", `${usd2(s.calculatedCents)} / month`]);
  const discount = s.discountCents ?? 0;
  const pct = s.calculatedCents ? Math.round((discount / s.calculatedCents) * 100) : 0;
  if (s.specialPlan && discount > 0) rows.push(["Special Discount", `−${usd2(discount)} (${pct}% off · student opted in)`]);
  if (!s.specialPlan && discount > 0) {
    rows.push(
      ["Coupon Code", s.couponCode ?? ""],
      ["Zakat Scholarship", `−${usd2(discount)} (${pct}% covered)`],
      ["Zakat Declaration", s.zakatDeclaration ? "✅ Confirmed by student" : "⚠️ NOT confirmed"],
    );
  }
  rows.push(["Monthly Amount Due", (s.paymentCents ?? 0) > 0 ? usd2(s.paymentCents) : "$0.00 (full Zakat scholarship)"]);
  if (s.aidLevel) {
    rows.push(["Help requested", labelOf(HELP_LEVELS, s.aidLevel)], ["Help note", s.aidNote ?? ""]);
  }
  rows.push(
    ["Preferred Days", weekdays(s.preferredDays)],
    ["Time Slot", s.timeSlotText ? `${s.timeSlotText}${s.timeZone ? ` · ${s.timeZone}` : ""}` : ""],
    ["Session Duration", s.sessionMinutes ? `${s.sessionMinutes} minutes` : ""],
    ["Teacher Preference", labelOf(TEACHER_PREFS, s.teacherPref ?? "")],
    ["Heard About Us Via", heard],
  );
  return rows;
}

/* ── Telegram ────────────────────────────────────────────────────────── */

const TELEGRAM_MAX = 4000;

/** IQU_Telegram::compose: bold title, "Label: <b>value</b>" rows (empty ones dropped), italic footer. */
export function composeTelegram(title: string, rows: Row[], footer = ""): string {
  const lines = [`<b>${esc(title)}</b>`, ""];
  for (const [label, raw] of rows) {
    const value = raw.trim();
    if (!value || value === "—") continue;
    lines.push(`${esc(label)}: <b>${esc(value)}</b>`);
  }
  if (footer) lines.push("", `<i>${esc(footer)}</i>`);
  const text = lines.join("\n");
  if (text.length <= TELEGRAM_MAX) return text;
  // Cut on a line boundary so no tag is left open (HTML parse mode refuses broken markup).
  const cut = text.slice(0, TELEGRAM_MAX - 40);
  return `${cut.slice(0, cut.lastIndexOf("\n"))}\n\n… (truncated)`;
}

export type NewRegistrationContext = {
  snapshot: Snapshot;
  route: Route;
  status: string;
  reasons: ReasonRow[];
  returning: boolean;
  /** False until the Stripe step exists (P2): the message says so instead of implying a card was asked for. */
  cardStepLive: boolean;
  now: Date;
};

export function newRegistrationTelegram(c: NewRegistrationContext): string {
  const s = c.snapshot;
  let title = "📝 New Registration";
  if (s.program === "monthly") {
    if ((s.discountCents ?? 0) > 0) {
      title = s.specialPlan
        ? "🎁 New Registration — Special Discount"
        : (s.paymentCents ?? 0) <= 0
          ? "🤲 New Registration — Full Zakat Scholarship"
          : "🎟️ New Registration — Partial Scholarship";
    } else if (s.aidLevel) {
      title = "🤲 New Registration — Help With the Fee Requested";
    }
  }
  const routeText =
    (c.route === "card" || c.route === "summer_pay") && !c.cardStepLive
      ? `${ROUTE_LABELS[c.route]} (Stripe not connected yet: saved, no payment page opened)`
      : ROUTE_LABELS[c.route];
  const rows: Row[] = adminRows(s).filter(([label]) => label !== "Form");
  rows.push(["Route", routeText], ["Status", STATUS_LABELS[c.status] ?? c.status], ["Review reasons", reasonsText(c.reasons)]);
  if (c.returning) rows.push(["Re-enrollment", "Existing record updated (same IQU number)"]);
  return composeTelegram(title, rows, `Registration #${s.id} · ${programLabel(s.program as Program)} · ${dhakaTime(c.now)}`);
}

/** Owner decision 12: an active student enrolled again. No "New Registration", no Lead (RE:133-142 wording). */
export function detailsUpdatedTelegram(s: Snapshot, now: Date): string {
  return composeTelegram(
    "🔁 Re-enrollment — details updated",
    [
      ["Student", `${s.firstName} ${s.lastName} (IQU-${s.id})`],
      ["Program", programLabel(s.program as Program)],
    ],
    `Still active: only the family's details were updated. Status, course, fee, payment and billing are unchanged. · ${dhakaTime(now)}`,
  );
}

/* ── Email ───────────────────────────────────────────────────────────── */

export type Email = { to: string; subject: string; html: string; text: string };

const HADITH_AR = "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ";
const HADITH_EN = "“The best of you are those who learn the Quran and teach it.”";
const HADITH_CITE = "Sahih al-Bukhari 5027";
const K1 = "After the free first month, tuition is charged on the 1st of each month.";
const WHATSAPP_NEXT = "We will contact you on WhatsApp within 24–48 hours, in sha’ Allah.";

function help(): string {
  const parts = [site.phone ? `call or WhatsApp ${site.phone.display}` : "", site.email ? `email ${site.email}` : ""].filter(Boolean);
  if (!parts.length) return "";
  const sentence = parts.join(", or ");
  return `Need help? ${sentence[0].toUpperCase()}${sentence.slice(1)}.`;
}

type Layout = {
  title: string;
  greeting: string;
  intro: string[];
  details: Row[];
  next: string[];
  /** Heading over `next` (default "What happens next"). */
  nextTitle?: string;
  /** One button after the steps; only an https link is ever rendered. */
  action?: { label: string; href: string };
  good?: string[];
};

const safeHref = (href: string) => (/^https:\/\/[^\s"<>]+$/.test(href) ? href : null);

/** One formal layout (inventory §9.2): 600 px table, a plain-text twin, the hadith block. */
function render(l: Layout): { html: string; text: string } {
  const details = l.details.filter(([, v]) => v.trim());
  const href = l.action ? safeHref(l.action.href) : null;
  const action = l.action && href ? { label: l.action.label, href } : null;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(l.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
<tr><td style="padding:24px 32px 8px;font-size:14px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:#3d4a5c;">${esc(site.name)}</td></tr>
<tr><td style="padding:8px 32px 0;"><h1 style="margin:0;font-size:22px;line-height:1.3;color:#1f2933;">${esc(l.title)}</h1></td></tr>
<tr><td style="padding:16px 32px 0;font-size:16px;line-height:1.6;">
<p style="margin:0 0 12px;">${esc(l.greeting)}</p>
${l.intro.map((p) => `<p style="margin:0 0 12px;">${esc(p)}</p>`).join("\n")}
</td></tr>
${
  details.length
    ? `<tr><td style="padding:8px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;line-height:1.5;border-top:1px solid #e3e6ea;">
${details.map(([k, v]) => `<tr><td style="padding:8px 12px 8px 0;color:#5b6675;vertical-align:top;width:40%;">${esc(k)}</td><td style="padding:8px 0;vertical-align:top;">${esc(v)}</td></tr>`).join("\n")}
</table></td></tr>`
    : ""
}
${
  l.next.length
    ? `<tr><td style="padding:16px 32px 0;"><h2 style="margin:0 0 8px;font-size:17px;">${esc(l.nextTitle ?? "What happens next")}</h2><ol style="margin:0;padding-left:20px;font-size:15px;line-height:1.6;">${l.next.map((n) => `<li style="margin:0 0 6px;">${esc(n)}</li>`).join("")}</ol></td></tr>`
    : ""
}
${
  action
    ? `<tr><td style="padding:20px 32px 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#1f2933;border-radius:8px;"><a href="${esc(action.href)}" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">${esc(action.label)}</a></td></tr></table></td></tr>`
    : ""
}
${
  l.good?.length
    ? `<tr><td style="padding:16px 32px 0;"><h2 style="margin:0 0 8px;font-size:17px;">Good to know</h2>${l.good.map((g) => `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;">${esc(g)}</p>`).join("")}</td></tr>`
    : ""
}
<tr><td style="padding:16px 32px 0;font-size:15px;line-height:1.6;">${esc(help())}</td></tr>
<tr><td style="padding:24px 32px 28px;">
<p lang="ar" dir="rtl" style="margin:0;font-size:22px;line-height:2;text-align:right;color:#1f2933;">${HADITH_AR}</p>
<p style="margin:4px 0 0;font-size:15px;line-height:1.6;">${esc(HADITH_EN)}</p>
<p style="margin:4px 0 0;font-size:13px;color:#5b6675;">${esc(HADITH_CITE)}</p>
</td></tr>
<tr><td style="padding:0 32px 24px;font-size:12px;line-height:1.5;color:#5b6675;">${esc(site.name)} · ${esc(site.legalName)} · ${esc(site.taxStatus)} · EIN ${esc(site.ein)}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    site.name,
    "",
    l.title,
    "",
    l.greeting,
    "",
    ...l.intro.flatMap((p) => [p, ""]),
    ...(details.length ? [...details.map(([k, v]) => `${k}: ${v}`), ""] : []),
    ...(l.next.length ? [l.nextTitle ?? "What happens next", ...l.next.map((n, i) => `${i + 1}. ${n}`), ""] : []),
    ...(action ? [`${action.label}: ${action.href}`, ""] : []),
    ...(l.good?.length ? ["Good to know", ...l.good, ""] : []),
    help(),
    "",
    HADITH_AR,
    HADITH_EN,
    HADITH_CITE,
    "",
    `${site.name} · ${site.legalName} · ${site.taxStatus} · EIN ${site.ein}`,
  ].join("\n");
  return { html, text };
}

export type FamilyEmailKind = Route | "summer_existing";

/** The family's email for this route (N11). `checkoutUrl` is the Stripe link once P2 exists. */
export function familyEmail(kind: FamilyEmailKind, s: Snapshot, opts: { checkoutUrl?: string | null } = {}): Email {
  const first = s.firstName;
  const greeting = `Assalamu alaikum ${s.guardianName?.trim() || first},`;
  const reference = `IQU-${s.id}`;
  const course = courseLabel(s.courseVariant);
  const monthly: Row[] = [
    ["Student", `${s.firstName} ${s.lastName}`],
    ["Reference", reference],
    ["Course", course],
    ["Days a week", s.daysPerWeek ? String(s.daysPerWeek) : ""],
    ["Your availability", s.timeSlotText ?? ""],
  ];
  const summer: Row[] = [
    ["Student", `${s.firstName} ${s.lastName}`],
    ["Reference", reference],
    ["Program", s.program === "summer_l2" ? "Summer Ilm Camp, Level 2" : "Summer Ilm Camp, Level 1"],
  ];

  const layouts: Record<FamilyEmailKind, { subject: string; layout: Layout }> = {
    card: {
      subject: `Next: add your card for ${first}'s classes — ${site.name}`,
      layout: {
        title: "Next: add your card",
        greeting,
        intro: [
          `JazakAllahu Khairan for enrolling ${first}. Your enrollment is saved.`,
          opts.checkoutUrl
            ? "One step is left: add a card or US bank account on Stripe, our secure payment page."
            : "One step is left: adding a card or US bank account on Stripe, our secure payment page. We will send you the secure link.",
          `Nothing is charged during the free month. ${K1}`,
          ...(opts.checkoutUrl ? [`Add your card: ${opts.checkoutUrl}`] : []),
        ],
        details: [...monthly, ["Monthly fee after the free month", formatUsd(s.paymentCents ?? 0)]],
        next: [
          opts.checkoutUrl ? "You add a card or bank account on Stripe" : "We send you a secure Stripe link, and you add a card or bank account",
          WHATSAPP_NEXT, "We match a teacher to the time you chose", "The first class"],
        good: ["Stripe keeps your card or bank details. We never see them."],
      },
    },
    review: {
      subject: `We received ${first}'s enrollment — ${site.name}`,
      layout: {
        title: "We received your enrollment",
        greeting,
        intro: [`JazakAllahu Khairan for enrolling ${first}.`, `Our team confirms the fee and the details with you first. ${WHATSAPP_NEXT}`],
        details: s.program === "monthly" ? monthly : summer,
        next: [WHATSAPP_NEXT, "We agree the fee with you; if a card is needed, we send a secure link", "We match a teacher to the time you chose", "The first class"],
        good: ["No child's place is ever affected by cost."],
      },
    },
    aid: {
      subject: `We received your request for help with the fee — ${site.name}`,
      layout: {
        title: "We received your request for help with the fee",
        greeting,
        intro: [`JazakAllahu Khairan for enrolling ${first}.`, "Our team will reply to you privately. No child's place is ever affected by cost."],
        details: [...monthly, ["Help asked for", labelOf(HELP_LEVELS, s.aidLevel ?? "")]],
        next: [`${WHATSAPP_NEXT} We keep this private.`, "We agree the fee together; you add a card only if there is one to pay", "We match a teacher to the time you chose", "The first class"],
      },
    },
    details: {
      subject: `We updated ${first}'s details — ${site.name}`,
      layout: {
        title: `We updated ${first}'s details`,
        greeting,
        intro: ["Thank you. We updated the details you sent. Classes and the fee stay as they are.", "If anything else needs to change, contact us."],
        details: [["Reference", reference]],
        next: [],
      },
    },
    weekend: {
      subject: `We received ${first}'s enrollment in the Weekend Ilm Program — ${site.name}`,
      layout: {
        title: "Weekend Ilm Program: enrollment received",
        greeting,
        intro: [
          `JazakAllahu Khairan for enrolling ${first}.`,
          "Classes are every Saturday and Sunday, 10–11 AM Central Time (CT), live on Zoom. The program is free for every child.",
        ],
        details: [
          ["Student", `${s.firstName} ${s.lastName}`],
          ["Reference", reference],
          ["Class days", "Saturday and Sunday, 10–11 AM CT"],
        ],
        next: [WHATSAPP_NEXT, "We send the Zoom link and the group details", "The first weekend class"],
      },
    },
    summer_pay: {
      subject: `Summer Ilm Camp: amount due ${formatUsd(s.paymentCents ?? 0)} — ${site.name}`,
      layout: {
        title: "Summer Ilm Camp: your enrollment is saved",
        greeting,
        intro: [
          `JazakAllahu Khairan for enrolling ${first}.`,
          opts.checkoutUrl
            ? "One step is left: pay the camp fee on Stripe, our secure payment page."
            : "One step is left: paying the camp fee on Stripe, our secure payment page. We will send you the secure link.",
          ...(opts.checkoutUrl ? [`Pay now: ${opts.checkoutUrl}`] : []),
        ],
        details: [...summer, ["Amount due", formatUsd(s.paymentCents ?? 0)]],
        next: [
          opts.checkoutUrl ? "You pay the fee on Stripe, and we email you a receipt" : "We send you a secure Stripe link; you pay the fee, and we email you a receipt",
          WHATSAPP_NEXT, "We send the Zoom link before the camp starts"],
      },
    },
    summer_existing: {
      subject: `We received ${first}'s Summer Ilm Camp enrollment — ${site.name}`,
      layout: {
        title: "We received your Summer Ilm Camp enrollment",
        greeting,
        intro: [`JazakAllahu Khairan for enrolling ${first}.`, "Current students do not pay for the camp. Our team confirms the place with you."],
        details: summer,
        next: [WHATSAPP_NEXT, "We send the Zoom link before the camp starts"],
      },
    },
  };
  const chosen = layouts[kind];
  return { to: s.email, subject: chosen.subject, ...render(chosen.layout) };
}

/** The team's notification (A4 + N8): the same rows as Telegram, with route, status and reasons. */
export function adminEmail(to: string, c: NewRegistrationContext): Email {
  const s = c.snapshot;
  const rows: Row[] = [
    ...adminRows(s),
    ["Route", ROUTE_LABELS[c.route] + ((c.route === "card" || c.route === "summer_pay") && !c.cardStepLive ? " (Stripe not connected yet)" : "")],
    ["Status", STATUS_LABELS[c.status] ?? c.status],
    ["Review reasons", reasonsText(c.reasons) || "None"],
    ...(c.returning ? ([["Re-enrollment", "Existing record updated (same IQU number)"]] as Row[]) : []),
    ["Received", dhakaTime(c.now)],
  ];
  const { html, text } = render({
    title: `New ${programLabel(s.program as Program)} registration #${s.id}`,
    greeting: "Assalamu alaikum,",
    intro: [`${s.firstName} ${s.lastName} enrolled on the website.`],
    details: rows,
    next: [],
  });
  return { to, subject: `[${site.name}] New ${programLabel(s.program as Program)} Registration #${s.id} — ${s.firstName} ${s.lastName}`, html, text };
}

/**
 * The card reminders at 24 h and 72 h (IQU_Enrollment::reminder_email,
 * class-iqu-enrollment.php:410-435): the same subjects, steps and notes, with
 * the "Finish enrollment" button on the family's own Stripe link. Never sent
 * without a link (the reminder job checks first).
 */
export function cardReminderEmail(to: string, firstName: string, link: string, last: boolean): Email {
  const kid = firstName.trim();
  const { html, text } = render({
    title: last ? "Last reminder: one step left" : "One step left",
    greeting: "Assalamu alaikum,",
    intro: [`You started enrolling ${kid} at ${site.name}. There is one step left.`],
    details: [],
    nextTitle: "What you need to do",
    next: [
      "Press “Finish enrollment” below.",
      "Add a card or US bank account on Stripe’s secure page (about 2 minutes).",
      "That’s all — we will confirm by email.",
    ],
    action: { label: "Finish enrollment", href: link },
    good: [
      "Nothing is charged today — the first month is free.",
      ...(last ? ["If we do not hear from you, this enrollment will close in a few days. You can enroll again at any time."] : []),
      "If you have a question, or the fee is a burden for your family, please talk to us — no child’s place is ever affected by cost.",
    ],
  });
  return { to, subject: last ? `Last reminder: finish ${kid}’s enrollment` : `One step left to enroll ${kid}`, html, text };
}

