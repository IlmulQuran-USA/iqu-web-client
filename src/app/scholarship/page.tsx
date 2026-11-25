import { HeartHandshake } from "lucide-react";
import { TextLink } from "@/components/course/PriceList";
import { FinalCta } from "@/components/home/FinalCta";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { dignity, donorLine, feeScale, howToAsk, scholarshipFinal, scholarshipHeader, scholarshipMeta } from "@/content/scholarship";
import { pageMetadata } from "@/lib/metadata";

/*
 * Help with fees — /scholarship (spec §7.18; plan approved by the owner,
 * answers 1–4 yes). Section order: what to ask for (the fee scale), the one
 * --tint section with the dignity statement, two steps, a quiet donor line,
 * then the band with the page's one filled button → /enroll?aid=request.
 * Nothing here makes a family prove anything; nothing implies a discount for
 * everyone. Copy and its sources: src/content/scholarship.ts.
 */

export const metadata = pageMetadata({ title: scholarshipMeta.title, description: scholarshipMeta.description, path: "/scholarship" });

export default function ScholarshipPage() {
  return (
    <>
      <Header />
      <main id="main-content" className="flex-1">
        <div className="container-content">
          <div className="pt-2 pb-8 md:pb-12">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: scholarshipHeader.title }]} />
            <h1 className="mt-4 text-display-md font-medium md:text-display-lg">{scholarshipHeader.title}</h1>
            <p className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body md:mt-6">{scholarshipHeader.intro}</p>
          </div>

          {/* The fee scale: a ledger of the four levels, with one worked example from the published fees. */}
          <section aria-labelledby="scale-title" className="border-t border-rule py-12 md:py-16">
            <h2 id="scale-title" className="text-heading-xl md:text-display-md">
              {feeScale.heading}
            </h2>
            {/* The example comes before the amounts, so "$33.60 a month" is never read without its course. */}
            <p className="mt-4 max-w-measure text-ui text-pretty text-ink-muted">{feeScale.exampleNote}</p>
            <dl className="mt-6 grid border-t border-ink sm:grid-cols-2 lg:grid-cols-4">
              {feeScale.levels.map((level) => (
                <div key={level.label} className="flex flex-col gap-1 border-b border-rule py-5 sm:pr-6 lg:border-b-0 lg:py-6">
                  <dt className="font-display text-heading-lg font-semibold text-ink">{level.label}</dt>
                  <dd className="text-body text-pretty text-ink-body">{level.youPay}</dd>
                  <dd className="mt-auto pt-2 text-ui text-ink-muted tabular-nums">
                    <span className="sr-only">In the example: </span>
                    {level.example}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 max-w-measure text-body text-pretty text-ink-body">{feeScale.everyoneNote}</p>
          </section>
        </div>

        {/* The page's one --tint section (DESIGN.md §2). */}
        <Reveal>
          <section aria-labelledby="dignity-title" className="bg-tint">
            <div className="container-content grid gap-6 py-12 md:py-16 lg:grid-cols-12 lg:gap-6 lg:py-24">
              <HeartHandshake aria-hidden="true" strokeWidth={1.5} className="size-10 text-accent-strong lg:col-span-1" />
              <div className="lg:col-span-8">
                <h2 id="dignity-title" className="text-display-md text-balance">
                  {dignity.statement}
                </h2>
                {dignity.body.map((p) => (
                  <p key={p} className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        <div className="container-content">
          <Reveal as="section" aria-labelledby="how-title" className="py-12 md:py-16 lg:py-24">
            <h2 id="how-title" className="text-heading-xl md:text-display-md">
              {howToAsk.heading}
            </h2>
            <ol className="mt-10 grid gap-10 md:grid-cols-2 md:gap-6">
              {howToAsk.steps.map((step, i) => (
                <RevealItem as="li" key={step.title} className="relative pl-16">
                  <span
                    aria-hidden="true"
                    className="absolute top-0 left-0 flex size-10 items-center justify-center rounded-pill border border-ink-body bg-paper font-display text-heading-md font-semibold text-ink tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <h3 className="font-display text-heading-md font-semibold text-ink">
                    <span className="sr-only">Step {i + 1}: </span>
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-measure text-body text-pretty text-ink-body">{step.body}</p>
                </RevealItem>
              ))}
            </ol>

            {/* The quiet donor line: text and a text link, never a competing button (PRODUCT.md: enrolment and giving stay apart). */}
            <p className="mt-16 flex flex-wrap items-center gap-x-3 border-t border-rule pt-6 text-body text-ink-muted">
              <span>{donorLine.text}</span>
              <TextLink label={donorLine.link.label} href={donorLine.link.href} />
            </p>
          </Reveal>
        </div>

        <FinalCta copy={scholarshipFinal} />
      </main>
      <Footer />
    </>
  );
}
