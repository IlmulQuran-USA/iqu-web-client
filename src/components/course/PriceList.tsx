import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { RevealItem } from "@/components/motion/Reveal";
import { cn } from "@/lib/cn";

/**
 * The prospectus price list, shared by Home §3 and the catalog (spec §7.1,
 * §7.2; owner decision 19 Nov 2026). Every course is one row and one link to
 * its page: the name in serif, an optional summary, the days line, and the
 * price set right in tabular figures. No images (no course photography
 * exists; never stock). Prices come only from src/content/pricing.ts.
 */
export function PriceList({
  labelledBy,
  children,
  className,
}: {
  labelledBy: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul aria-labelledby={labelledBy} className={cn("border-t border-ink", className)}>
      {children}
    </ul>
  );
}

/**
 * One course: the whole row is the link. Hover tints the row (--surface-2),
 * underlines the name and nudges the arrow; focus draws the global ring.
 * `step` numbers a row on the learning path (the order is the information).
 *
 * The link is named by the step, the course name and the price only; the
 * summary and the days line are its description, so a screen reader does not
 * read every sentence as the link name.
 */
export function PriceRow({
  href,
  name,
  meta,
  price,
  summary,
  step,
}: {
  href: string;
  name: string;
  meta: string;
  price: ReactNode;
  summary?: string | null;
  step?: number;
}) {
  const key = `row${href.replace(/[^a-z0-9]+/gi, "-")}`;
  const labelledBy = [step ? `${key}-step` : null, `${key}-name`, `${key}-price`].filter(Boolean).join(" ");
  const describedBy = [summary ? `${key}-summary` : null, `${key}-meta`].filter(Boolean).join(" ");
  return (
    // Inside a Reveal, each row follows the one before it in (owner, 22 Nov 2026).
    <RevealItem as="li" className="border-b border-rule">
      <Link
        href={href}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={cn(
          "group -mx-3 grid items-center gap-x-4 gap-y-1 rounded-card px-3 py-4 transition-[background-color,translate] duration-(--duration-micro) ease-riwaq hov:bg-surface-2 motion-safe:act:translate-y-px sm:gap-x-6 sm:py-5",
          step
            ? "grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto]"
            : "grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto]",
        )}
      >
        {step ? (
          <span
            aria-hidden="true"
            className="row-span-2 self-start font-display text-heading-lg font-semibold text-accent-strong tabular-nums sm:row-span-1"
          >
            {step}
          </span>
        ) : null}
        <span className="min-w-0">
          {step ? (
            <span id={`${key}-step`} className="sr-only">
              Step {step}:
            </span>
          ) : null}
          <span
            id={`${key}-name`}
            className="block font-display text-heading-md font-semibold text-ink decoration-1 decoration-accent-strong underline-offset-4 group-hover:underline sm:text-heading-lg"
          >
            {name}
          </span>
          {summary ? (
            <span id={`${key}-summary`} className="mt-1.5 block max-w-measure text-body text-pretty text-ink-body">
              {summary}
            </span>
          ) : null}
          <span id={`${key}-meta`} className={cn("block text-ui text-ink-muted", summary ? "mt-1.5" : "mt-1")}>
            {meta}
          </span>
        </span>
        <span
          id={`${key}-price`}
          className={cn(
            "row-start-2 sm:row-start-1 sm:text-right",
            step ? "col-start-2 sm:col-start-3" : "col-start-1 sm:col-start-2",
          )}
        >
          {price}
        </span>
        <ArrowRight
          aria-hidden="true"
          strokeWidth={1.5}
          className={cn(
            "row-span-2 row-start-1 size-5 text-ink-muted transition-transform duration-(--duration-micro) ease-riwaq group-hover:translate-x-0.5 group-hover:text-ink motion-reduce:transition-none sm:row-span-1",
            step ? "col-start-3 sm:col-start-4" : "col-start-2 sm:col-start-3",
          )}
        />
      </Link>
    </RevealItem>
  );
}

/** A price figure: serif, tabular. */
export function Amount({ children }: { children: ReactNode }) {
  return (
    <span className="font-display text-heading-md font-semibold text-ink tabular-nums sm:text-heading-lg">
      {children}
    </span>
  );
}

/** "from $20/month", "$80/month", "Free", "$40 one-time" with an optional note under it. */
export function Price({
  amount,
  prefix,
  suffix,
  note,
}: {
  amount: string;
  prefix?: string;
  suffix?: string;
  note?: string;
}) {
  return (
    <span className="whitespace-nowrap">
      {prefix ? <span className="text-ui text-ink-muted">{prefix} </span> : null}
      <Amount>{amount}</Amount>
      {suffix ? <span className="text-ui text-ink-muted">{suffix}</span> : null}
      {note ? <span className="block text-ui whitespace-normal text-ink-muted">{note}</span> : null}
    </span>
  );
}

/** Moved to src/components/ui/TextLink.tsx (no client imports); re-exported for existing imports. */
export { TextLink } from "@/components/ui/TextLink";
