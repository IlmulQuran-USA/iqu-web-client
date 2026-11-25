"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { programs } from "@/content/pricing";
import { site } from "@/content/site";
import { browserConsent } from "@/lib/consent";
import type { Confirmation, ConfirmationState } from "@/lib/enroll/confirmation";
import { LAST_KEY, SEED_KEY } from "@/lib/enroll/keys";
import { InlineAlert } from "./fields";

/*
 * /enroll/confirmation (plan B3.6, owner decisions 12, 13, 19 and correction D).
 * Personal details never travel in the URL: the first name and the "enroll
 * another child" seed come from this tab's sessionStorage, written just
 * before the submit. The Meta Lead fires here once per event id, and only
 * with marketing consent (decision 1).
 */

type Last = { name?: string; variant?: "monthly" | "weekend" | "summer"; course?: string; schedule?: string; seed?: Record<string, unknown> };

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const WHATSAPP = "We will contact you on WhatsApp within 24–48 hours";
const noSubscribe = () => () => {};

function content(state: ConfirmationState, name: string) {
  const s: Record<ConfirmationState, { title: string; body: string; steps: string[] }> = {
    card: {
      title: "Thank you. We’re confirming your card with Stripe.",
      body: "Nothing is charged during the free month. After the free first month, tuition is charged on the 1st of each month. We email you as soon as Stripe confirms.",
      steps: ["Stripe confirms your card, and we email you", `${WHATSAPP}`, "We match a teacher to the time you chose", "The first class"],
    },
    review: {
      title: "We received your enrollment.",
      body: "Our team confirms the fee and the details with you before anything else happens.",
      steps: [`${WHATSAPP}`, "We agree the fee with you; if a card is needed, we send a secure link", "We match a teacher to the time you chose", "The first class"],
    },
    aid: {
      title: "We received your request for help with the fee.",
      body: "Our team will reply to you privately. No child’s place is ever affected by cost.",
      steps: [`${WHATSAPP}, privately`, "We agree the fee together; you add a card only if there is one to pay", "We match a teacher to the time you chose", "The first class"],
    },
    details: {
      title: `We updated ${name ? `${name}’s` : "your"} details.`,
      body: "Classes and the fee stay as they are. If anything else needs to change, contact us.",
      steps: [],
    },
    weekend: {
      title: `We received ${name ? `${name}’s` : "your"} enrollment in the Weekend Ilm Program.`,
      body: "Classes are on Saturday and Sunday, 10–11 AM CT, live on Zoom. The program is free for every child.",
      steps: [`${WHATSAPP}`, "We send the Zoom link and the group details", "The first weekend class"],
    },
    summer: {
      title: "Thank you. We’re confirming your payment with Stripe.",
      body: "We email you a receipt as soon as Stripe confirms the payment.",
      steps: ["Stripe confirms the payment, and we email you", `${WHATSAPP}`, "We send the Zoom link before the camp starts"],
    },
    "summer-review": {
      title: "We received your Summer Ilm Camp enrollment.",
      body: "Our team confirms the fee with you. No child’s place is ever affected by cost.",
      steps: [`${WHATSAPP}`, "We agree the fee with you", "We send the Zoom link before the camp starts"],
    },
    "summer-existing": {
      title: "We received your Summer Ilm Camp enrollment.",
      body: "Current students do not pay for the camp.",
      steps: [`${WHATSAPP}`, "We send the Zoom link before the camp starts"],
    },
    "card-next": {
      title: "We saved your enrollment.",
      // Same words as the family email without a checkout link (messages.ts familyEmail "card").
      body: "One step is left: adding a card or US bank account on Stripe, our secure payment page. We will send you the secure link. Nothing is charged during the free month. After the free first month, tuition is charged on the 1st of each month.",
      steps: ["We send you a secure Stripe link, and you add a card or bank account", `${WHATSAPP}`, "We match a teacher to the time you chose", "The first class"],
    },
    "summer-next": {
      title: "We saved your Summer Ilm Camp enrollment.",
      body: "One step is left: paying the camp fee on Stripe, our secure payment page. We will send you the secure link.",
      steps: ["We send you a secure Stripe link; you pay the fee, and we email you a receipt", `${WHATSAPP}`, "We send the Zoom link before the camp starts"],
    },
  };
  return s[state];
}

/** Until P2 connects Stripe, these states end here: the family is told plainly, nothing is faked. */
const CARD_STEP_PENDING: ReadonlySet<ConfirmationState> = new Set(["card-next", "summer-next"]);

export function ConfirmationView({ confirmation }: { confirmation: Confirmation }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  // This tab's last submit (first name, seed). Empty on the server; read once in the browser.
  const raw = useSyncExternalStore(
    noSubscribe,
    () => {
      try {
        return window.sessionStorage.getItem(LAST_KEY) ?? "";
      } catch {
        return "";
      }
    },
    () => "",
  );
  const last = useMemo<Last>(() => {
    try {
      return raw ? (JSON.parse(raw) as Last) : {};
    } catch {
      return {};
    }
  }, [raw]);

  // Meta Lead: once per event id, only with consent, only if the pixel is on the page.
  useEffect(() => {
    const lead = confirmation.lead;
    if (!lead || browserConsent() !== "granted" || typeof window.fbq !== "function") return;
    const key = `iqu-lead-${lead.eventId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Without storage the event may repeat; Meta deduplicates by eventID.
    }
    window.fbq("track", "Lead", { content_name: lead.contentName, content_category: "registration", currency: "USD", value: lead.value }, { eventID: lead.eventId });
  }, [confirmation.lead]);

  const name = last.name ?? "";
  const c = content(confirmation.state, name);

  async function copy() {
    if (!confirmation.reference) return;
    try {
      await navigator.clipboard.writeText(confirmation.reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  function enrollAnother() {
    try {
      if (last.seed) window.localStorage.setItem(SEED_KEY, JSON.stringify(last.seed));
    } catch {
      // Without storage the next form simply starts empty.
    }
    const variant = last.variant ?? (confirmation.state.startsWith("summer") ? "summer" : confirmation.state === "weekend" ? "weekend" : "monthly");
    router.push(variant === "monthly" ? "/enroll" : `/enroll?program=${variant === "weekend" ? programs.weekend.id : programs.summer.id}`);
  }

  return (
    // Prose page: the body measure (DESIGN.md §3). Only named widths exist (globals.css).
    <div className="max-w-measure">
      <h1 className="font-display text-heading-xl font-semibold text-balance text-ink">{c.title}</h1>
      <p className="mt-4 text-body-lg text-ink-body">{c.body}</p>

      {CARD_STEP_PENDING.has(confirmation.state) ? (
        <InlineAlert
          tone="info"
          className="mt-6"
          title={confirmation.state === "summer-next" ? "Payment step is not connected yet." : "Card step is not connected yet."}
        >
          Your enrollment is saved and waits for {confirmation.state === "summer-next" ? "the payment" : "a card"}. This test site cannot take
          payments yet, so nothing is charged.
        </InlineAlert>
      ) : null}

      {confirmation.reference ? (
        <div className="mt-8 flex flex-wrap items-center gap-4 rounded-card bg-surface p-5">
          <div>
            <p className="text-ui text-ink-muted">Your reference</p>
            <p className="mt-1 font-display text-heading-lg font-semibold tracking-wide text-ink">{confirmation.reference}</p>
          </div>
          <Button
            variant="secondary"
            className="ml-auto"
            onClick={copy}
            iconStart={copied ? <Check aria-hidden="true" strokeWidth={1.5} className="size-4" /> : <Copy aria-hidden="true" strokeWidth={1.5} className="size-4" />}
          >
            {copied ? "Copied" : "Copy"}
            <span className="sr-only"> reference {confirmation.reference}</span>
          </Button>
          <p className="sr-only" aria-live="polite">
            {copied ? "Reference copied" : ""}
          </p>
        </div>
      ) : null}

      {c.steps.length ? (
        <section aria-labelledby="next-title" className="mt-10">
          <h2 id="next-title" className="font-display text-heading-md font-semibold text-ink">
            What happens next
          </h2>
          <ol className="mt-4 flex flex-col gap-4">
            {c.steps.map((step, i) => (
              <li key={step} className="flex gap-4">
                <span aria-hidden="true" className="inline-flex size-8 shrink-0 items-center justify-center rounded-pill bg-surface text-ui font-medium text-ink">
                  {i + 1}
                </span>
                <span className="pt-1 text-body text-ink">{step}.</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {site.whatsapp ? (
        <p className="mt-8 text-body text-ink-body">
          Questions?{" "}
          <a href={site.whatsapp.href} className="inline-flex min-h-11 items-center text-link underline decoration-1 underline-offset-2 hov:decoration-2">
            {/* One child, so the flex link (44 px target) wraps as text; the number never splits. */}
            <span>
              Message us on WhatsApp at <span className="whitespace-nowrap">{site.whatsapp.display}</span>
            </span>
          </a>
        </p>
      ) : null}

      <div className="mt-10 flex flex-wrap gap-3">
        {confirmation.state !== "details" ? (
          <Button variant="secondary" onClick={enrollAnother}>
            Enroll another child
          </Button>
        ) : null}
        <Link href="/courses" className="inline-flex min-h-11 items-center px-1 text-body text-link underline decoration-1 underline-offset-2 hov:decoration-2">
          Explore our courses
        </Link>
      </div>

      {/* Owner-approved Hadith (decision 19): its own block, right to left, line-height 2, full citation. */}
      <figure className="mt-14 border-t border-rule pt-8">
        <blockquote>
          <p lang="ar" dir="rtl" className="text-right font-[serif] text-heading-md leading-[2] text-ink">
            خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ
          </p>
          <p className="mt-2 text-body text-ink-body">“The best of you are those who learn the Quran and teach it.”</p>
        </blockquote>
        <figcaption className="mt-2 text-ui text-ink-muted">Sahih al-Bukhari 5027</figcaption>
      </figure>
    </div>
  );
}
