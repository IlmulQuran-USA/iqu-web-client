import { ArrowUpRight } from "lucide-react";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { footerColumns, legalLinks, socialLinks, type NavLink } from "@/content/navigation";
import { PENDING, site } from "@/content/site";
import { cn } from "@/lib/cn";
import { NewsletterForm } from "./NewsletterForm";
import { Wordmark } from "./Wordmark";

/**
 * Public footer (spec §6.2).
 * - The newsletter band sits above the columns, separated by hairlines rather
 *   than a coloured band (DESIGN.md §1).
 * - Four columns: Identity · Learn · Organisation · Support us. The EIN sits
 *   under the giving column (DESIGN.md §10).
 * - Legal strip: © year AL HASANAH FOUNDATION · Privacy · Terms · Refund
 *   policy · Accessibility statement, with social links on the right
 *   (Facebook only, labelled; see navigation.ts).
 * - The language toggle waits for a Bangla locale (spec §10.3 Q6).
 * - A contact value that is null shows [pending] (CLAUDE.md §4).
 */

async function copyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

// Colour is set per link, never here, so Donate's --accent is not fighting a
// base text colour (cn() joins classes; it does not resolve conflicts).
const columnLink =
  "inline-flex min-h-11 min-w-11 items-center gap-1 rounded-chip text-body " +
  "decoration-1 underline-offset-2 hov:underline";

const stripLink =
  "inline-flex min-h-11 items-center gap-1 rounded-chip px-2 text-ui text-ink-muted " +
  "decoration-1 underline-offset-2 hov:text-primary hov:underline";

const contactLink =
  "inline-flex min-h-11 items-center rounded-chip text-ink underline decoration-1 underline-offset-2 " +
  "hov:text-primary hov:decoration-2";

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

  return (
    <footer className="mt-auto border-t border-rule">
      <section aria-labelledby="newsletter-title" className="border-b border-rule">
        <div className="container-content grid gap-6 py-12 md:grid-cols-12 md:gap-6 md:py-16">
          <div className="md:col-span-5">
            <h2 id="newsletter-title" className="text-heading-lg text-ink">
              News from Ilm-ul-Quran USA
            </h2>
            <p className="mt-2 max-w-measure text-body text-ink-muted">
              New classes, program dates and what your support makes possible.
            </p>
          </div>
          <div className="md:col-span-7 lg:col-span-6 lg:col-start-7">
            <NewsletterForm />
          </div>
        </div>
      </section>

      <div className="container-content grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:py-16 lg:grid-cols-12 lg:gap-6">
        <div className="col-span-2 lg:col-span-4">
          <Wordmark />
          <p className="mt-3 max-w-measure text-body text-ink-muted">{site.mission}</p>
          <p className="mt-4 text-ui font-medium text-ink">
            {site.legalName} is a {site.taxStatus}.{" "}
            <span className="whitespace-nowrap">
              EIN <span className="tabular-nums">{site.ein}</span>.
            </span>
          </p>
          <address className="mt-4 text-ui text-ink-muted not-italic">
            {site.address.line1}
            <br />
            {site.address.line2}
          </address>
          <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 text-ui">
            <dt className="text-ink-muted">Phone</dt>
            <dd>
              {site.phone ? (
                <a href={site.phone.href} className={cn(contactLink, "tabular-nums")}>
                  {site.phone.display}
                </a>
              ) : (
                <span className="text-ink">{PENDING}</span>
              )}
            </dd>
            <dt className="text-ink-muted">Email</dt>
            <dd>
              {site.email ? (
                <a href={`mailto:${site.email}`} className={contactLink}>
                  {site.email}
                </a>
              ) : (
                <span className="text-ink">{PENDING}</span>
              )}
            </dd>
          </dl>
        </div>

        {footerColumns.map((column) => {
          const headingId = `footer-${column.title.toLowerCase().replace(/\s+/g, "-")}`;
          return (
            <nav key={column.title} aria-labelledby={headingId} className="lg:col-span-2 lg:first-of-type:col-start-6">
              <h2 id={headingId} className="eyebrow">
                {column.title}
              </h2>
              <ul className="mt-2 flex flex-col">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <FooterLink
                      link={link}
                      className={cn(
                        columnLink,
                        link.href === "/donate" ? "font-medium text-accent" : "text-ink hov:text-primary",
                      )}
                    />
                  </li>
                ))}
              </ul>
              {column.giving ? (
                // DESIGN.md §10: the EIN sits next to every giving ask.
                <p className="mt-3 text-ui text-ink-muted">
                  {site.taxStatus}
                  <br />
                  <span className="whitespace-nowrap">
                    EIN <span className="tabular-nums">{site.ein}</span>
                  </span>
                </p>
              ) : null}
            </nav>
          );
        })}
      </div>

      <div className="border-t border-rule">
        <div className="container-content flex flex-col gap-2 py-6 md:flex-row md:items-center md:justify-between">
          <p className="text-ui text-ink-muted">
            © {year} {site.legalName}
          </p>
          <div className="-mx-2 flex flex-wrap items-center gap-x-4">
            <ul aria-label="Legal" className="flex flex-wrap items-center">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <FooterLink link={link} className={stripLink} />
                </li>
              ))}
            </ul>
            <ul aria-label="Social media" className="flex flex-wrap items-center">
              {socialLinks.map((link) => (
                <li key={link.href}>
                  <FooterLink link={link} className={stripLink} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
