import { Check } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { TeachForm } from "@/components/teach/TeachForm";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { InlineText } from "@/components/ui/InlineText";
import { teachCourses, teachFacts, teachForm, teachHeader, teachMeta } from "@/content/teach";
import { pageMetadata } from "@/lib/metadata";
import { teachConfig } from "@/lib/server/teach";

/*
 * Teach with us — /teach (spec §7.16; owner, 27 Nov 2026). Replaces the live
 * /instructor-registration page, which had no form (src/content/teach.ts).
 * How classes work and what we teach (settled facts only), beside the
 * application (src/components/teach/TeachForm.tsx). Without the mailer, the
 * database or the hash secret the form is replaced by "Applications open
 * soon." and the email address: a submission is never faked.
 */

export const metadata = pageMetadata({ title: teachMeta.title, description: teachMeta.description, path: "/teach" });

export default function TeachPage() {
  const open = teachConfig() !== null;
  return (
    <>
      <Header />
      <main id="main-content" className="container-content flex-1 pb-16 md:pb-24">
        <div className="pt-2 pb-8 md:pb-12">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: teachHeader.title }]} />
          <h1 className="mt-4 text-display-md font-medium text-balance md:text-display-lg">{teachHeader.title}</h1>
          <p className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body md:mt-6">{teachHeader.lead}</p>
        </div>

        <div className="grid gap-12 lg:grid-cols-12 lg:gap-6">
          <div className="flex flex-col gap-12 lg:col-span-5">
            <section aria-labelledby="teach-facts-title">
              <h2 id="teach-facts-title" className="text-heading-xl">
                {teachFacts.heading}
              </h2>
              <ul className="mt-6 flex flex-col border-t border-ink">
                {teachFacts.items.map((item) => (
                  <li key={item} className="flex gap-3 border-b border-rule py-4 text-body text-pretty text-ink-body">
                    <Check aria-hidden="true" strokeWidth={1.5} className="mt-1 size-4 shrink-0 text-accent-strong" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="teach-courses-title">
              <h2 id="teach-courses-title" className="text-heading-xl">
                {teachCourses.heading}
              </h2>
              <ul className="mt-4 flex flex-col">
                {teachCourses.items.map((c) => (
                  <li key={c.href}>
                    <Link href={c.href} className="inline-flex min-h-11 items-center text-body text-link underline decoration-1 underline-offset-2 hov:decoration-2">
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section aria-labelledby="teach-form-title" className="lg:col-span-6 lg:col-start-7">
            <h2 id="teach-form-title" className="text-heading-xl">
              {teachForm.heading}
            </h2>
            {open ? (
              <>
                <p className="mt-2 text-body text-ink-body">{teachForm.intro}</p>
                <div className="mt-6">
                  <TeachForm />
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-card bg-surface p-6 sm:p-8">
                <p className="text-body-lg font-medium text-ink">{teachForm.closed}</p>
                <p className="mt-2 text-body text-ink-body">
                  <InlineText text={teachForm.closedHelp} />
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
