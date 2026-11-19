import { BellRing } from "lucide-react";
import { site } from "@/content/site";
import { cn } from "@/lib/cn";
import { NewsletterForm } from "./NewsletterForm";

/**
 * Newsletter card at the top of the footer (owner decision, 20 Nov 2026).
 * A white card (--paper) on the --band footer: 12 px radius, 32 px padding
 * (24 px on phones), no edge. Inside, the light-surface rules apply: --ink
 * text, --ink-muted secondary, the --focus (#0F172A) ring, and a field with a
 * 1 px slate-500 border (--field-border-subtle, 4.8:1). Subscribe is a filled
 * coral button: an allowed exception to "one filled button per view", because
 * it sits inside its own card (CLAUDE.md §4).
 *
 * `open` is decided by the caller: the footer passes whether every Brevo
 * setting is present, so the live site never shows a form that cannot work;
 * /dev/components shows both states for review. Closed, the right side shows
 * a BellRing with "Sign-up opens soon.", centred against the heading block.
 */
export function NewsletterCard({
  open,
  headingId = "newsletter-title",
  className,
}: {
  open: boolean;
  /** Unique per page; /dev/components renders more than one card. */
  headingId?: string;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        // Light-surface focus ring and the slate-500 field border inside the card.
        "rounded-card bg-paper p-6 text-ink [--field-border:var(--field-border-subtle)] [--focus:var(--ink)] sm:p-8",
        className,
      )}
    >
      <div className={cn("grid gap-6 lg:grid-cols-12", !open && "lg:items-center")}>
        <div className="lg:col-span-5">
          <h2 id={headingId} className="font-display text-heading-lg font-semibold text-ink">
            News from{" "}
            {/* --ink on --mark 13.2:1; the name never breaks at its hyphens. */}
            <mark
              translate="no"
              className="rounded-chip bg-mark px-1 whitespace-nowrap text-ink [box-decoration-break:clone]"
            >
              {site.name}
            </mark>
          </h2>
          <p className="mt-2 max-w-measure text-body text-ink-muted">
            New classes, program dates and what your support makes possible.
          </p>
        </div>
        <div className="lg:col-span-7 xl:col-span-6 xl:col-start-7">
          {open ? (
            <NewsletterForm />
          ) : (
            <p className="flex items-center gap-3 text-body-lg font-medium text-ink">
              <BellRing aria-hidden="true" strokeWidth={1.5} className="size-6 shrink-0 text-accent-strong" />
              Sign-up opens soon.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
