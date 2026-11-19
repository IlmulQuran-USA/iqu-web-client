import { ArrowUpRight } from "lucide-react";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { footerColumns, legalLinks, socialLinks, type NavLink } from "@/content/navigation";
import { PENDING, site } from "@/content/site";
import { cn } from "@/lib/cn";
import { newsletterConfig } from "@/lib/server/brevo";
import { Logo } from "./Logo";
import { NewsletterForm } from "./NewsletterForm";

/**
 * Public footer (spec §6.2; owner decision, 19 Nov 2026).
 * - Dark --band: white text, slate-300 secondary, coral accents and a coral
 *   focus ring (DESIGN.md §1–§2). A top hairline separates it from a --band
 *   section above it (the Home final CTA).
 * - The content uses the header's container exactly: the brand group starts
 *   on the header logo's left edge and Support us ends on the right edge of
 *   the header's Start free trial button. From lg the four groups spread
 *   across that width (first flush left, last flush right, equal space
 *   between) and share one height (the brand group's content sits at its
 *   top). Below lg: brand, then Learn and
 *   Organization side by side, then Support us.
 * - Brand group: the logo at the header's 40 px, a one- or two-line
 *   description, Phone and Email. Each link column has exactly six rows; the
 *   sixth row of Support us is the 501(c)(3) · EIN line, the only place the
 *   EIN appears.
 * - Bottom bar on the same edges: © year, legal name and the street address
 *   on the left; legal links and Facebook on the right, on one row from xl
 *   (where both fit); stacked below.
 * - Newsletter: the top row inside the footer, on --band (not a separate
 *   band), on the same container edges and above a hairline: the serif
 *   heading and one line on the left, the form on the right. When any Brevo
 *   setting is missing the form is replaced by "Sign-up opens soon." so a form
 *   that cannot work is never shown (src/lib/server/brevo.ts).
 * - The language toggle waits for a Bangla locale (spec §10.3 Q6).
 * - A contact value that is null shows [pending] (CLAUDE.md §4).
 */

async function copyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

// On --band: links are white (17.9:1) and underline on hover. Only Donate is
// coral (6.2:1), so a hovered link never looks like the giving ask.
// Colour is set per link, never in the shared base, so Donate's coral is not
// fighting a base text colour (cn() joins classes; it does not resolve conflicts).
const columnLink =
  "-mx-1 inline-flex min-h-11 min-w-11 items-center gap-1 rounded-chip px-1 text-body " +
  "decoration-1 underline-offset-2 hov:underline";

const stripLink =
  "inline-flex min-h-11 items-center gap-1 rounded-chip px-2 text-ui text-on-band-muted " +
  "decoration-1 underline-offset-2 hov:text-on-band hov:underline";

const contactLink =
  "inline-flex min-h-11 items-center rounded-chip text-on-band underline decoration-1 underline-offset-2 " +
  "hov:decoration-2";

/** Internal links use next/link; external ones open a new tab and say so. */
function FooterLink({ link, className }: { link: NavLink; className: string }) {
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
        {link.label}
        <ArrowUpRight aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  );
}

export async function Footer() {
  const year = await copyrightYear();
  const [learn, organization, support] = footerColumns;
  // Read on the server only; the settings never reach the browser.
  const newsletterOpen = newsletterConfig() !== null;

  return (
    <footer className="mt-auto">
      <div className="band border-t border-ink-body">
        <section aria-labelledby="newsletter-title" className="container-content">
          <div className="grid gap-6 border-b border-ink-body py-12 md:py-16 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-5">
              <h2 id="newsletter-title" className="font-display text-heading-lg font-semibold text-on-band">
                News from <span translate="no">{site.name}</span>
              </h2>
              <p className="mt-2 max-w-measure text-body text-on-band-muted">
                New classes, program dates and what your support makes possible.
              </p>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              {newsletterOpen ? (
                <NewsletterForm />
              ) : (
                <p className="text-body font-medium text-on-band lg:pt-2">Sign-up opens soon.</p>
              )}
            </div>
          </div>
        </section>

        <div className="container-content py-12 md:py-16">
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:flex lg:items-stretch lg:justify-between lg:gap-x-8">
            {/* Brand group: logo, description, then Phone and Email directly beneath. */}
            <div className="col-span-2">
              <div>
                <Logo variant="footer" />
                <p className="mt-3 max-w-72 text-body text-on-band-muted">{site.footerLine}</p>
              </div>
              <dl className="mt-6 grid grid-cols-[auto_1fr] items-center gap-x-3 text-ui">
                <dt className="text-on-band-muted">Phone</dt>
                <dd>
                  {site.phone ? (
                    <a href={site.phone.href} className={cn(contactLink, "tabular-nums whitespace-nowrap")}>
                      {site.phone.display}
                    </a>
                  ) : (
                    <span className="text-on-band">{PENDING}</span>
                  )}
                </dd>
                <dt className="text-on-band-muted">Email</dt>
                <dd>
                  {site.email ? (
                    <a href={`mailto:${site.email}`} className={contactLink}>
                      {site.email}
                    </a>
                  ) : (
                    <span className="text-on-band">{PENDING}</span>
                  )}
                </dd>
              </dl>
            </div>

            <Column column={learn} />
            <Column column={organization} />
            <Column column={support} className="col-span-2">
              {/* The sixth row of Support us: the only place the EIN appears (DESIGN.md §10). */}
              <li className="flex min-h-11 items-center text-ui text-on-band-muted">
                {site.taxStatus} ·&nbsp;
                <span className="whitespace-nowrap">
                  EIN <span className="tabular-nums">{site.ein}</span>
                </span>
              </li>
            </Column>
          </div>
        </div>

        <div className="border-t border-ink-body">
          {/* One row from xl, where both halves fit; stacked below, so nothing wraps mid-line. */}
          <div className="container-content flex flex-col gap-2 py-6 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
            <p className="text-ui text-on-band-muted">
              © {year} {site.legalName} · {site.address.line1},{" "}
              <span className="whitespace-nowrap">{site.address.line2}</span>
            </p>
            <ul aria-label="Legal and social" className="-mx-2 flex flex-wrap items-center xl:justify-end">
              {[...legalLinks, ...socialLinks].map((link, i) => (
                <Fragment key={link.href}>
                  {i > 0 ? (
                    // Separators only where the bar is one line (xl), so a dot never dangles at a wrap.
                    <li aria-hidden="true" className="hidden text-ui text-on-band-muted xl:block">
                      ·
                    </li>
                  ) : null}
                  <li>
                    <FooterLink link={link} className={stripLink} />
                  </li>
                </Fragment>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Column({
  column,
  className,
  children,
}: {
  column: (typeof footerColumns)[number];
  className?: string;
  children?: ReactNode;
}) {
  const headingId = `footer-${column.title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <nav aria-labelledby={headingId} className={className}>
      <h2 id={headingId} className="eyebrow">
        {column.title}
      </h2>
      <ul className="mt-2 flex flex-col">
        {column.links.map((link) => (
          <li key={link.href}>
            <FooterLink
              link={link}
              className={cn(columnLink, link.href === "/donate" ? "font-medium text-accent" : "text-on-band")}
            />
          </li>
        ))}
        {children}
      </ul>
    </nav>
  );
}
