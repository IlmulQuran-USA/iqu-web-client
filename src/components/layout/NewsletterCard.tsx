import { site } from "@/content/site";
import { cn } from "@/lib/cn";
import { NewsletterForm } from "./NewsletterForm";

/**
 * Newsletter card at the top of the footer (owner decision, 20 Nov 2026).
 * A slate-800 card (--band-card) on the --band footer: 12 px radius, a 3 px
 * --accent left edge, 32 px padding (24 px on phones). The serif heading and
 * one line on the left, the form on the right from lg; stacked below.
 * Inside: white text, slate-300 secondary, a slate-900 field with a slate-500
 * border (3.07:1 on the card, 3.75:1 on the fill) and the outline Subscribe.
 *
 * `open` is decided by the caller: the footer passes whether every Brevo
 * setting is present, so the live site never shows a form that cannot work;
 * /dev/components shows both states for review.
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
      className={cn("rounded-card border-l-3 border-accent bg-band-card p-6 sm:p-8", className)}
    >
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h2 id={headingId} className="font-display text-heading-lg font-semibold text-on-band">
            News from{" "}
            {/* The name never breaks at its hyphens. */}
            <span translate="no" className="whitespace-nowrap">
              {site.name}
            </span>
          </h2>
          <p className="mt-2 max-w-measure text-body text-on-band-muted">
            New classes, program dates and what your support makes possible.
          </p>
        </div>
        <div className="lg:col-span-7 xl:col-span-6 xl:col-start-7">
          {open ? (
            <NewsletterForm />
          ) : (
            <p className="text-body font-medium text-on-band lg:pt-2">Sign-up opens soon.</p>
          )}
        </div>
      </div>
    </section>
  );
}
