import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { courses } from "@/content/courses";
import { fromPrice, programs, usd } from "@/content/pricing";
import { site } from "@/content/site";
import { robotsFor, socialDefaults, TITLE_TEMPLATE } from "@/lib/metadata";

// No canonical: a 404 has no address of its own.
const notFoundDescription = "This page has moved or no longer exists. Find a course, see the fees or contact Ilm-Ul-Quran USA.";
export const metadata: Metadata = {
  title: "Page not found",
  description: notFoundDescription,
  ...socialDefaults(TITLE_TEMPLATE.replace("%s", "Page not found"), notFoundDescription),
  robots: robotsFor({ index: false, follow: true }),
};

/** The programs, the teachers, help and enrollment: the pages old links most often meant. */
const helpfulLinks = [
  { label: programs.weekend.label, href: programs.weekend.href },
  { label: programs.summer.label, href: programs.summer.href },
  { label: "Our teachers", href: "/instructors" },
  { label: "Frequently asked questions", href: "/faq" },
  { label: "Contact us", href: "/contact" },
  { label: "Start free trial", href: "/enroll" },
];

/**
 * The site's 404 (critique, owner 20 Nov 2026): old WordPress links and
 * mistyped course URLs land here with the header, the footer and a way on,
 * not on the framework's bare page. Lists every course that has a page, in
 * the Home price-list style, links back to Home, and offers the programs,
 * teachers, FAQ, contact and enrollment. Every live WordPress URL is
 * redirected before it could get here (src/lib/legacy-redirect.ts).
 */
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main-content" className="container-content pt-12 pb-16 md:pt-16 lg:pb-24">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-5">
            <h1 className="text-display-md font-medium text-balance md:text-display-lg">We can’t find that page.</h1>
            <p className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body">
              The link may be old or mistyped. Every course at <span translate="no">{site.name}</span> is listed here.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex min-h-11 items-center gap-1.5 rounded-chip text-body font-medium text-link underline decoration-1 underline-offset-2 hov:decoration-2"
            >
              Go to the home page
              <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
            </Link>
            {/* Where most old links were headed (the live site's most visited pages; owner, 27 Nov 2026). No search box. */}
            <nav aria-labelledby="not-found-more" className="mt-10">
              <h2 id="not-found-more" className="font-sans text-ui font-medium text-ink-muted">
                Other places to look
              </h2>
              <ul className="mt-2 flex flex-col">
                {helpfulLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-11 items-center rounded-chip text-body text-link underline decoration-1 underline-offset-2 hov:decoration-2"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <nav aria-labelledby="not-found-courses" className="lg:col-span-7">
            <h2 id="not-found-courses" className="font-sans text-ui font-medium text-ink-muted">
              Our courses
            </h2>
            <ul className="mt-3 border-t border-ink">
              {courses.map((course) => (
                <li key={course.id} className="border-b border-rule">
                  <Link
                    href={course.href}
                    className="group -mx-3 flex min-h-14 items-center gap-4 rounded-card px-3 py-3 transition-colors duration-(--duration-micro) ease-riwaq hov:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1 font-display text-heading-md font-semibold text-ink decoration-1 decoration-accent-strong underline-offset-4 group-hover:underline">
                      {course.label}
                    </span>
                    <span className="text-ui text-ink-muted tabular-nums">
                      {course.minDays === course.maxDays ? "" : "from "}
                      {usd(fromPrice(course))}/month
                    </span>
                    <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-5 shrink-0 text-ink-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>
      <Footer />
    </>
  );
}
