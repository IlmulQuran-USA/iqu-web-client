import { ArrowUpRight } from "lucide-react";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { footerColumns, legalLinks, socialLinks, type NavLink } from "@/content/navigation";
import { PENDING, site } from "@/content/site";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";
import { NewsletterForm } from "./NewsletterForm";

/**
 * Public footer (spec §6.2).
 * - The newsletter band sits above the columns on --tint. The columns and
 *   legal strip sit on the dark --band: white text, slate-300 secondary,
 *   coral accents and a coral focus ring (DESIGN.md §1–§2).
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

// On --band: links are white (17.9:1) and underline on hover. Only Donate is
// coral (6.2:1), so a hovered link never looks like the giving ask.
// Colour is set per link, never in the shared base, so Donate's coral is not
// fighting a base text colour (cn() joins classes; it does not resolve conflicts).
const columnLink =
  "inline-flex min-h-11 min-w-11 items-center gap-1 rounded-chip text-body " +
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

  return (
    <footer className="mt-auto">
      <section aria-labelledby="newsletter-title" className="bg-tint">
        <div className="container-content grid gap-6 py-12 md:grid-cols-12 md:gap-6 md:py-16">
          <div className="md:col-span-5">
            <h2 id="newsletter-title" className="text-heading-lg text-ink">
              News from Ilm-Ul-Quran USA
            </h2>
            <p className="mt-2 max-w-measure text-body text-ink-body">
              New classes, program dates and what your support makes possible.
            </p>
          </div>
          <div className="md:col-span-7 lg:col-span-6 lg:col-start-7">
            <NewsletterForm />
          </div>
        </div>
      </section>

      <div className="band">
        <div className="container-content grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:py-16 lg:grid-cols-12 lg:gap-6">
          <div className="col-span-2 lg:col-span-4">
            <Logo variant="footer" />
            <p className="mt-3 max-w-measure text-body text-on-band-muted">{site.mission}</p>
            <p className="mt-4 text-ui font-medium text-on-band">
              {site.legalName} is a {site.taxStatus}.{" "}
              <span className="whitespace-nowrap">
                EIN <span className="tabular-nums">{site.ein}</span>.
              </span>
            </p>
            <address className="mt-4 text-ui text-on-band-muted not-italic">
              {site.address.line1}
              <br />
              {site.address.line2}
            </address>
            <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 text-ui">
              <dt className="text-on-band-muted">Phone</dt>
              <dd>
                {site.phone ? (
                  <a href={site.phone.href} className={cn(contactLink, "tabular-nums")}>
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
                          link.href === "/donate" ? "font-medium text-accent" : "text-on-band",
                        )}
                      />
                    </li>
                  ))}
                </ul>
                {column.giving ? (
                  // DESIGN.md §10: the EIN sits next to every giving ask.
                  <p className="mt-3 text-ui text-on-band-muted">
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

        <div className="border-t border-ink-body">
          <div className="container-content flex flex-col gap-2 py-6 md:flex-row md:items-center md:justify-between">
            <p className="text-ui text-on-band-muted">
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
      </div>
    </footer>
  );
}
