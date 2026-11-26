import { ExternalLink } from "lucide-react";
import { TextLink } from "@/components/ui/TextLink";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ButtonLink } from "@/components/ui/Button";
import { GirihLattice } from "@/components/ui/GirihLattice";
import { InlineText } from "@/components/ui/InlineText";
import { donateHero, donateMeta, giftUse, giveCard, otherWays, zakat } from "@/content/donate";
import { pageMetadata } from "@/lib/metadata";

/*
 * Donate — /donate (spec §7.10; plan giving-about-shape-plan.md §1.2 option A,
 * §1.3; owner, 26 Nov 2026). Our page, then one hand-off to the live Zeffy
 * form. No amount widget (a choice here could not survive the hand-off).
 *
 * "Donate on Zeffy" is the page's one filled button; a giving page has no
 * enrollment button (Header `giving`), and the header's Donate keeps its
 * outlined style. The 501(c)(3) status and EIN sit right under the button.
 * Mobile: the give card follows the H1, before anything else; desktop: it is
 * the hero's right column. The girih lattice is the donation hero's (DESIGN.md
 * §1). No scroll reveals: the page is short and the card must never wait.
 */

export const metadata = pageMetadata({ title: donateMeta.title, description: donateMeta.description, path: "/donate" });

export default function DonatePage() {
  return (
    <>
      <Header giving />
      <main id="main-content" className="flex-1">
        <section aria-labelledby="donate-title" className="relative overflow-hidden">
          <GirihLattice className="text-accent-strong opacity-[0.06]" />
          <div className="container-content relative pt-2 pb-12 md:pb-16 lg:pb-24">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: donateMeta.title }]} />
            <div className="mt-4 grid gap-10 lg:grid-cols-12 lg:gap-6">
              <div className="lg:col-span-6">
                <h1 id="donate-title" className="text-display-md font-medium text-balance md:text-display-lg">
                  {donateHero.title}
                </h1>
                <p className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body md:mt-6">{donateHero.lead}</p>
              </div>

              {/* The hand-off card: what the donor will find on Zeffy, then the one action. */}
              <div className="rounded-card border border-rule bg-paper p-6 shadow-card md:p-8 lg:col-span-5 lg:col-start-8">
                <h2 className="font-display text-heading-lg font-semibold text-ink">{giveCard.title}</h2>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-body text-pretty text-ink-body marker:text-ink-muted">
                  {giveCard.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <ButtonLink
                  href={giveCard.button.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="primary"
                  size="lg"
                  fullWidth
                  className="mt-6"
                  iconEnd={<ExternalLink aria-hidden="true" strokeWidth={1.5} className="size-4" />}
                >
                  {giveCard.button.label}
                  <span className="sr-only"> (opens zeffy.com in a new tab)</span>
                </ButtonLink>
                <p className="mt-2 text-center text-ui text-ink-muted">{giveCard.handoff}</p>
                {/* 501(c)(3) status and EIN next to the button (spec §7.10). */}
                <p className="mt-4 border-t border-rule pt-4 text-ui text-pretty text-ink-body tabular-nums">{giveCard.legal}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="container-content">
          <section aria-labelledby="gift-title" className="border-t border-rule py-12 md:py-16">
            <div className="grid gap-6 lg:grid-cols-12">
              <h2 id="gift-title" className="text-heading-xl md:text-display-md lg:col-span-4">
                {giftUse.heading}
              </h2>
              <div className="lg:col-span-8">
                {giftUse.body.map((p) => (
                  <p key={p} className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body first:mt-0">
                    {p}
                  </p>
                ))}
                <TextLink label={giftUse.link.label} href={giftUse.link.href} className="mt-4" />
              </div>
            </div>
          </section>

          {[zakat, otherWays].map((block) => (
            <section
              key={block.heading}
              aria-labelledby={`${block === zakat ? "zakat" : "other"}-title`}
              id={block === zakat ? "zakat" : "monthly"}
              className="border-t border-rule py-12 md:py-16"
            >
              <div className="grid gap-6 lg:grid-cols-12">
                <h2 id={`${block === zakat ? "zakat" : "other"}-title`} className="text-heading-xl md:text-display-md lg:col-span-4">
                  {block.heading}
                </h2>
                <div className="space-y-4 lg:col-span-8">
                  {block.body.map((p) => (
                    <p key={p} className="max-w-measure text-body-lg text-pretty text-ink-body">
                      <InlineText text={p} />
                    </p>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
