import { BookOpenCheck, ShieldCheck, UsersRound } from "lucide-react";
import { TextLink } from "@/components/ui/TextLink";
import { FINAL_CTA_ID, FinalCta } from "@/components/home/FinalCta";
import { Footer } from "@/components/layout/Footer";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { Header } from "@/components/layout/Header";
import { Reveal, RevealItem } from "@/components/motion/Reveal";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import {
  aboutFees,
  aboutGiving,
  aboutHeader,
  aboutLegal,
  aboutMeta,
  aboutMissionGoal,
  aboutStory,
  aboutTeachers,
  aboutTeaching,
} from "@/content/about";
import { finalCta } from "@/content/home";
import { pageMetadata } from "@/lib/metadata";

/*
 * About — /about (spec §7.6; plan giving-about-shape-plan.md Page 2; owner,
 * 26 Nov 2026). Section order: header (who we are) · history · mission and
 * goal · help with fees · how we teach · our teachers · organization
 * information · the quiet giving line · the enrollment band (the page's one
 * filled button). The timeline, the numbers and leadership are not rendered
 * until the owner supplies them (src/content/about.ts, listed by content:check).
 */

export const metadata = pageMetadata({ title: aboutMeta.title, description: aboutMeta.description, path: "/about" });

const teachingIcons = [BookOpenCheck, UsersRound, ShieldCheck] as const;

const contactLink = "text-link underline decoration-1 underline-offset-2 hov:decoration-2";

export default function AboutPage() {
  const { phone, email } = aboutLegal.contact;
  return (
    <MotionProvider>
      <Header yieldCtaTo={FINAL_CTA_ID} />
      <main id="main-content" className="flex-1">
        <div className="container-content">
          <div className="pt-2 pb-8 md:pb-12">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: aboutHeader.title }]} />
            <h1 className="mt-4 text-display-md font-medium md:text-display-lg">{aboutHeader.title}</h1>
            <p className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body md:mt-6">{aboutHeader.lead}</p>
          </div>

          <Reveal as="section" aria-labelledby="history-title" className="border-t border-rule py-12 md:py-16">
            <div className="grid gap-6 lg:grid-cols-12">
              <h2 id="history-title" className="text-heading-xl md:text-display-md lg:col-span-4">
                {aboutStory.heading}
              </h2>
              <div className="space-y-4 lg:col-span-8">
                {aboutStory.body.map((p) => (
                  <p key={p} className="max-w-measure text-body-lg text-pretty text-ink-body">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal as="section" aria-label="Mission and goal" className="border-t border-rule py-12 md:py-16">
            <ul className="grid gap-6 md:grid-cols-2">
              {aboutMissionGoal.map((card) => (
                <RevealItem as="li" key={card.title} className="rounded-card border border-rule bg-paper p-6 md:p-8">
                  <h2 className="font-display text-heading-lg font-semibold text-ink">{card.title}</h2>
                  <p className="mt-3 text-body text-pretty text-ink-body">{card.text}</p>
                </RevealItem>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* The page's one --tint section (DESIGN.md §2): help with fees. */}
        <Reveal as="section" aria-labelledby="fees-title" className="bg-tint">
          <div className="container-content py-12 md:py-16">
            <h2 id="fees-title" className="text-heading-xl md:text-display-md">
              {aboutFees.heading}
            </h2>
            <p className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body">{aboutFees.text}</p>
            <TextLink label={aboutFees.link.label} href={aboutFees.link.href} className="mt-4" />
          </div>
        </Reveal>

        <div className="container-content">
          <Reveal as="section" aria-labelledby="teaching-title" className="py-12 md:py-16 lg:py-24">
            <h2 id="teaching-title" className="text-heading-xl md:text-display-md">
              {aboutTeaching.heading}
            </h2>
            <p className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body">{aboutTeaching.intro}</p>
            <ul className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
              {aboutTeaching.items.map((item, i) => {
                const Icon = teachingIcons[i];
                return (
                  <RevealItem as="li" key={item.title} className="border-t border-ink pt-5">
                    <Icon aria-hidden="true" strokeWidth={1.5} className="size-7 text-accent-strong" />
                    <h3 className="mt-4 font-display text-heading-md font-semibold text-ink">{item.title}</h3>
                    <p className="mt-2 text-body text-pretty text-ink-body">{item.text}</p>
                  </RevealItem>
                );
              })}
            </ul>
            <TextLink label={aboutTeaching.link.label} href={aboutTeaching.link.href} className="mt-8" />
          </Reveal>

          <Reveal as="section" aria-labelledby="teachers-title" className="border-t border-rule py-12 md:py-16">
            <div className="grid gap-6 lg:grid-cols-12">
              <h2 id="teachers-title" className="text-heading-xl md:text-display-md lg:col-span-4">
                {aboutTeachers.heading}
              </h2>
              <div className="lg:col-span-8">
                <p className="max-w-measure text-body-lg text-pretty text-ink-body">{aboutTeachers.text}</p>
                <TextLink label={aboutTeachers.link.label} href={aboutTeachers.link.href} className="mt-4" />
              </div>
            </div>
          </Reveal>

          {/* Legal identity, pulled out of prose into a bordered card (spec §7.6 section 7). */}
          <Reveal as="section" aria-labelledby="legal-title" className="border-t border-rule py-12 md:py-16">
            <div className="grid gap-6 lg:grid-cols-12">
              <h2 id="legal-title" className="text-heading-xl md:text-display-md lg:col-span-4">
                {aboutLegal.heading}
              </h2>
              <div className="rounded-card border border-rule bg-paper p-6 md:p-8 lg:col-span-8">
                <dl className="grid gap-x-6 gap-y-3 text-body sm:grid-cols-[11rem_1fr] sm:items-center">
                  {aboutLegal.rows.map((row) => (
                    <div key={row.label} className="contents">
                      <dt className="text-ui font-medium text-ink-muted">{row.label}</dt>
                      <dd className="text-ink tabular-nums">{row.value}</dd>
                    </div>
                  ))}
                  {phone ? (
                    <div className="contents">
                      <dt className="text-ui font-medium text-ink-muted">Phone</dt>
                      <dd>
                        <a href={phone.href} className={`${contactLink} inline-flex min-h-11 items-center tabular-nums`}>
                          {phone.display}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {email ? (
                    <div className="contents">
                      <dt className="text-ui font-medium text-ink-muted">Email</dt>
                      <dd className="min-w-0">
                        <a href={`mailto:${email}`} className={`${contactLink} inline-flex min-h-11 items-center break-all`}>
                          {email}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <p className="mt-6 border-t border-rule pt-4 text-ui text-pretty text-ink-muted">{aboutLegal.ownership}</p>
              </div>
            </div>
          </Reveal>

          {/* The quiet giving line: text and a text link, never a competing button. */}
          <p className="flex flex-wrap items-center gap-x-3 border-t border-rule py-8 text-body text-ink-muted">
            <span>{aboutGiving.text}</span>
            <TextLink label={aboutGiving.link.label} href={aboutGiving.link.href} />
          </p>
        </div>

        <FinalCta copy={finalCta} />
      </main>
      <Footer />
    </MotionProvider>
  );
}
