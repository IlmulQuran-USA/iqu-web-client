import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { courses } from "@/content/courses";
import { fromPrice, usd } from "@/content/pricing";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/**
 * The site's 404 (critique, owner 20 Nov 2026): old WordPress links and
 * mistyped course URLs land here with the header, the footer and a way on,
 * not on the framework's bare page. Lists every course that has a page, in
 * the Home price-list style, and links back to Home.
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
