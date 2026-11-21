import { ArrowRight, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { NewsletterCard } from "@/components/layout/NewsletterCard";
import { ArchFrame } from "@/components/ui/ArchFrame";
import { Button, ButtonLink, type ButtonVariant } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { pageMetadata } from "@/lib/metadata";
import { BlurValidationDemo, LoadingButtonDemo } from "./demos";

export const metadata: Metadata = pageMetadata({
  title: "Component reference",
  description: "Development reference: every interface component of the Ilm-Ul-Quran USA site, in every state.",
  path: "/dev/components",
  robots: { index: false, follow: false },
});

/*
 * Development-only reference: every primitive in every state.
 * Hover, focus-visible and active are shown at rest through data-force, which
 * only this page sets; the hov:/act: variants and the focus ring in
 * globals.css also match it.
 */

/* Slate + Coral (DESIGN.md §2). Ratio is against --paper unless noted. */
const colourGroups = [
  {
    title: "Neutrals",
    tokens: [
      ["--ink", "#0F172A", "Headings, display · 17.9:1"],
      ["--ink-body", "#334155", "Body text · 10.4:1"],
      ["--ink-muted", "#475569", "Captions, secondary · 7.6:1"],
      ["--paper", "#FFFFFF", "Page"],
      ["--surface-2", "#F8FAFC", "Alternate sections, ReadOnlyFact"],
      ["--surface", "#F1F5F9", "Cards, wells, table stripes"],
      ["--rule", "#E2E8F0", "Hairlines, borders (decorative)"],
    ],
  },
  {
    title: "Actions and focus",
    tokens: [
      ["--primary", "#0F172A", "Filled primary, white label · 17.9:1"],
      ["--primary-hover", "#1E293B", "Primary hover · 14.6:1"],
      ["--focus", "#0F172A", "2 px ring; coral on --band"],
      ["--band", "#0F172A", "Footer, final CTA band"],
    ],
  },
  {
    title: "Coral",
    tokens: [
      ["--accent", "#F96C48", "Marks, shapes; text only on --band (6.2:1)"],
      ["--accent-strong", "#D45C3D", "Large text and icons · 3.9:1"],
      ["--link", "#AE4C32", "Text links, Donate · 5.4:1"],
      ["--tint", "#FEF0ED", "One section per page at most; selected"],
      ["--mark", "#FDD5CA", "Highlighter behind a key phrase"],
    ],
  },
] as const;

/* Soft badges: tint background + strong text, never a solid fill. */
const statusBadges = [
  ["Success", "bg-success-tint text-success", "5.4:1"],
  ["Warning", "bg-warning-tint text-warning", "5.2:1"],
  ["Danger", "bg-danger-tint text-danger", "6.1:1"],
  ["Info", "bg-info-tint text-info", "5.6:1"],
] as const;

const typeScale = [
  ["Display XL · Newsreader 500 · 64", "font-display text-display-xl font-medium", "Quran taught by scholars"],
  ["Display L · Newsreader 500 · 48", "font-display text-display-lg font-medium", "Quran taught by scholars"],
  ["Display M · Newsreader 600 · 36", "font-display text-display-md font-semibold", "Quran taught by scholars"],
  ["Heading XL · Newsreader 600 · 30", "font-display text-heading-xl font-semibold", "Meet the instructors"],
  ["Heading L · Newsreader 600 · 24", "font-display text-heading-lg font-semibold", "Meet the instructors"],
  ["Heading M · Newsreader 600 · 20", "font-display text-heading-md font-semibold", "Meet the instructors"],
  ["Body L · Plex Sans 400 · 18", "text-body-lg", "Live classes from Bangladesh to families in North America, at times that suit your time zone."],
  ["Body · Plex Sans 400 · 16", "text-body", "Live classes from Bangladesh to families in North America, at times that suit your time zone."],
  ["UI · Plex Sans 500 · 14", "text-ui font-medium", "Guardian email"],
  ["UI small · Plex Sans 500 · 13", "text-ui-sm font-medium", "Step 2 of 5"],
] as const;

const states = [
  ["Default", {}],
  ["Hover", { "data-force": "hover" }],
  ["Focus-visible", { "data-force": "focus" }],
  ["Active", { "data-force": "active" }],
  ["Disabled", { disabled: true }],
  ["Loading", { loading: true }],
] as const;

const variantNotes: Record<ButtonVariant, string> = {
  primary: "One per view. Enroll, Save.",
  secondary: "An alternative action.",
  ghost: "Tertiary or in-table. Underline on hover.",
  tonal: "A quiet utility action: Log in.",
  danger: "Destructive. Always behind a confirm dialog.",
  link: "A standalone text action in --link. In prose, use a plain <a>.",
  band: "Primary action on the dark band: coral fill, slate label.",
};

const variantLabel: Record<ButtonVariant, string> = {
  primary: "Start free trial",
  secondary: "Ask a question",
  ghost: "View details",
  tonal: "Log in",
  danger: "Delete record",
  link: "Request a correction",
  band: "Start free trial",
};

export default function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <>
      <Header />
      <main id="main-content" className="container-content flex flex-col gap-24 py-12 md:py-16">
        <div>
          <h1 className="text-display-md md:text-display-lg">Component reference</h1>
          <p className="mt-4 max-w-measure text-body-lg text-ink-muted">
            Development only. This page shows the Riwāq tokens (Slate + Coral palette) and every primitive in
            every state, at 375 and 1440. It returns 404 in production.
          </p>
        </div>

        <Section id="tokens" title="Tokens">
          <SubTitle>Color</SubTitle>
          {colourGroups.map((group) => (
            <div key={group.title}>
              <p className="eyebrow mb-3">{group.title}</p>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.tokens.map(([token, hex, use]) => (
                  <li key={token} className="flex items-center gap-4">
                    <span
                      aria-hidden="true"
                      className="size-12 shrink-0 rounded-chip border border-rule"
                      style={{ backgroundColor: `var(${token})` }}
                    />
                    <span className="min-w-0">
                      <span className="block font-mono text-mono text-ink">{token}</span>
                      <span className="block text-ui text-ink-muted">
                        <span className="font-mono">{hex}</span> · {use}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <SubTitle>Status (soft badges)</SubTitle>
          <ul className="flex flex-wrap gap-3">
            {statusBadges.map(([label, cls, ratio]) => (
              <li key={label} className={`inline-flex min-h-8 items-center rounded-pill px-3 text-ui font-medium ${cls}`}>
                {label} <span className="ml-2 font-normal tabular-nums">{ratio}</span>
              </li>
            ))}
          </ul>

          <SubTitle>Dark band</SubTitle>
          <div className="band rounded-card p-6 md:p-8">
            <p className="font-display text-heading-lg font-semibold">Text on the band is white</p>
            <p className="mt-2 max-w-measure text-body text-on-band-muted">
              Secondary text is slate-300 (12.0:1). Coral is allowed here as{" "}
              <a href="#footer" className="text-accent underline decoration-1 underline-offset-2">
                link text
              </a>{" "}
              (6.2:1). Focus inside the band shows a coral ring.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button variant="band">Start free trial</Button>
              <Button variant="band" data-force="focus">
                Focus-visible
              </Button>
            </div>
          </div>

          <SubTitle>Type</SubTitle>
          <ul className="flex flex-col divide-y divide-rule border-y border-rule">
            {typeScale.map(([label, cls, sample]) => (
              <li key={label} className="grid gap-2 py-5 lg:grid-cols-12 lg:gap-6">
                <span className="text-ui text-ink-muted lg:col-span-3">{label}</span>
                <span className={`${cls} max-w-measure break-words ${cls.includes("font-display") ? "text-ink" : "text-ink-body"} lg:col-span-9`}>
                  {sample}
                </span>
              </li>
            ))}
            <li className="grid gap-2 py-5 lg:grid-cols-12 lg:gap-6">
              <span className="text-ui text-ink-muted lg:col-span-3">Highlight · --mark behind a key phrase</span>
              <span className="font-display text-display-md font-semibold text-ink lg:col-span-9">
                Nearly half our students study{" "}
                <mark className="rounded-chip bg-mark px-1 text-ink [box-decoration-break:clone]">at no cost</mark>
              </span>
            </li>
            <li className="grid gap-2 py-5 lg:grid-cols-12 lg:gap-6">
              <span className="text-ui text-ink-muted lg:col-span-3">Large coral · --accent-strong · 24 px+</span>
              <span className="font-display text-heading-lg font-semibold text-accent-strong lg:col-span-9">
                Sabaq · Sabqi · Manzil
              </span>
            </li>
            <li className="grid gap-2 py-5 lg:grid-cols-12 lg:gap-6">
              <span className="text-ui text-ink-muted lg:col-span-3">Eyebrow · 13 · 0.08em</span>
              <span className="eyebrow lg:col-span-9">By level</span>
            </li>
          </ul>

          <SubTitle>Radius and elevation</SubTitle>
          <ul className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              ["Input / chip · 4", "rounded-input"],
              ["Button · 8", "rounded-button"],
              ["Card · 12 · elevation 1", "rounded-card shadow-card"],
              ["Overlay · elevation 2", "rounded-card shadow-overlay"],
            ].map(([label, cls]) => (
              <li key={label}>
                <span aria-hidden="true" className={`block h-20 border border-rule bg-surface-2 ${cls}`} />
                <span className="mt-2 block text-ui text-ink-muted">{label}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="button" title="Button">
          <p className="max-w-measure text-body text-ink-muted">
            Every variant has a hit area of at least 44 × 44 px. Focus is a 2 px slate ring with a 2 px offset (coral on
            the dark band).
            While loading, the spinner replaces the label at a fixed width and repeat clicks are ignored.
          </p>
          {(Object.keys(variantNotes) as ButtonVariant[]).map((variant) => (
            <div key={variant}>
              <SubTitle>
                <span className="capitalize">{variant}</span>
                <span className="ml-3 font-sans text-ui font-normal text-ink-muted">{variantNotes[variant]}</span>
              </SubTitle>
              <ul
                className={`mt-4 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-6 ${
                  variant === "band" ? "band rounded-card p-6" : ""
                }`}
              >
                {states.map(([state, props]) => (
                  <li key={state} className="flex flex-col items-start gap-2">
                    <span className={`text-ui-sm ${variant === "band" ? "text-on-band-muted" : "text-ink-muted"}`}>
                      {state}
                    </span>
                    <Button variant={variant} {...props}>
                      {variantLabel[variant]}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <SubTitle>Sizes, icons and links</SubTitle>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="lg">Book my free trial class</Button>
            <Button size="lg" variant="secondary">
              Explore courses
            </Button>
            <Button iconEnd={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-5" />}>Continue</Button>
            <Button variant="danger" iconStart={<Trash2 aria-hidden="true" strokeWidth={1.5} className="size-5" />}>
              Delete
            </Button>
            <ButtonLink href="/enroll" variant="secondary">
              ButtonLink → /enroll
            </ButtonLink>
          </div>

          <SubTitle>Live loading</SubTitle>
          <LoadingButtonDemo />

          <SubTitle>Full width (drawer CTAs)</SubTitle>
          <div className="flex max-w-96 flex-col gap-2">
            <Button variant="secondary" fullWidth>
              Log in
            </Button>
            <Button fullWidth>Start free trial</Button>
          </div>
        </Section>

        <Section id="text-field" title="TextField">
          <p className="max-w-measure text-body text-ink-muted">
            The label is always visible. Validation runs on blur, never on keystroke. The error sits beside the
            field, with an icon and text, and is announced politely.
          </p>
          <div className="grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
            <TextField label="Student first name" name="s-default" autoComplete="off" />
            <TextField
              label="Student first name"
              name="s-hover"
              autoComplete="off"
              data-force="hover"
              hint="Forced hover state."
            />
            <TextField
              label="Student first name"
              name="s-focus"
              autoComplete="off"
              data-force="focus"
              hint="Forced focus-visible state."
            />
            <TextField
              label="Guardian WhatsApp number"
              name="s-hint"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              hint="Include the country code, e.g. +1 for the US and Canada."
            />
            <TextField label="Middle name" name="s-optional" optional autoComplete="off" />
            <TextField
              label="Student full name"
              name="s-filled"
              autoComplete="off"
              defaultValue="Muhammad Abdullah ibn Yusuf al-Rahman"
            />
            <TextField
              label="Guardian email"
              name="s-error"
              type="email"
              autoComplete="off"
              defaultValue="amina@example"
              error="Enter an email address in the format name@example.com."
            />
            <TextField
              label="Course"
              name="s-disabled"
              autoComplete="off"
              defaultValue="Quran Hifz"
              disabled
              hint="Disabled: unavailable right now. This is not how a system fact looks."
            />
            <BlurValidationDemo />
          </div>
        </Section>

        <Section id="arch-frame" title="ArchFrame">
          <p className="max-w-measure text-body text-ink-muted">
            One construction at three scales: a card, a profile, and a hero or auth photograph. A missing portrait
            shows an initial monogram, never a stock photo: Newsreader initials in --ink-body on --surface, with a 1 px
            --accent hairline on the arch edge. A failed image falls back to the monogram.
          </p>

          <SubTitle>Image at three scales</SubTitle>
          <div className="flex flex-wrap items-end gap-6">
            <Frame caption="Card · 160 px" width="w-40">
              <ArchFrame name="Sample" alt="Sample tonal study (dev only)" src="/dev/arch-sample.svg" width={800} height={800} sizes="160px" />
            </Frame>
            <Frame caption="Profile · 288 px" width="w-72">
              <ArchFrame name="Sample" alt="Sample tonal study (dev only)" src="/dev/arch-sample.svg" width={800} height={800} sizes="288px" />
            </Frame>
            <Frame caption="Hero / auth · tall · 360 px" width="w-full max-w-90">
              <ArchFrame
                name="Sample"
                alt="Sample tonal study (dev only)"
                src="/dev/arch-sample.svg"
                width={800}
                height={800}
                ratio="tall"
                sizes="360px"
              />
            </Frame>
          </div>

          <SubTitle>Missing portrait: monogram (real names, photo withheld to show the fallback)</SubTitle>
          <div className="flex flex-wrap items-end gap-6">
            <Frame caption="Mufti Ariful Islam → AI" width="w-40">
              <ArchFrame name="Mufti Ariful Islam" />
            </Frame>
            <Frame caption="Hafez Nurul Ahsan → NA" width="w-72">
              <ArchFrame name="Hafez Nurul Ahsan" />
            </Frame>
            <Frame caption="Mufti Ahmed Mostafa Raian → AR" width="w-full max-w-90">
              <ArchFrame name="Mufti Ahmed Mostafa Raian" ratio="tall" />
            </Frame>
          </div>

          <SubTitle>Error, loading and plain</SubTitle>
          <div className="flex flex-wrap items-end gap-6">
            <Frame caption="Broken src → monogram" width="w-40">
              <ArchFrame name="Mufti Shaker Waliullah" src="/dev/missing-photo.jpg" width={800} height={800} sizes="160px" />
            </Frame>
            <Frame caption="Empty opening: --surface (the loading fill)" width="w-40">
              <ArchFrame name="" decorative />
            </Frame>
            <Frame caption="Photo without the hairline" width="w-40">
              <ArchFrame
                name="Sample"
                alt="Sample tonal study (dev only)"
                src="/dev/arch-sample.svg"
                width={800}
                height={800}
                sizes="160px"
                hairline={false}
              />
            </Frame>
          </div>
        </Section>

        <Section id="header" title="Header">
          <ul className="flex max-w-measure list-disc flex-col gap-2 pl-5 text-body text-ink-muted">
            <li>The live header is at the top of this page and stays put as you scroll.</li>
            <li>Its bottom hairline appears after 40 px of scroll.</li>
            <li>Courses opens the panel by level, by age and the featured program. Programs and About open lists.</li>
            <li>Escape, a click outside, or tabbing away closes a menu.</li>
            <li>Below 1024 px a menu button opens the drawer. Its sections fold open, the CTAs are pinned, focus is trapped, and Escape closes it.</li>
          </ul>
        </Section>

        <Section id="footer" title="Footer">
          <p className="max-w-measure text-body text-ink-muted">
            The live footer is below: four columns and the legal strip with Facebook. The Zeffy and Facebook links
            open in a new tab and say so. The newsletter card sits at the top of the footer. The live footer shows
            the form only when every Brevo setting is present; otherwise it reads &ldquo;Sign-up opens soon.&rdquo; Both
            states are shown here for review, whatever the settings say.
          </p>
          <SubTitle>Newsletter card: form</SubTitle>
          <div id="newsletter-demo-form" className="band py-8">
            <div>
              <NewsletterCard open headingId="newsletter-demo-form-title" />
            </div>
          </div>
          <SubTitle>Newsletter card: sign-up opens soon</SubTitle>
          <div id="newsletter-demo-soon" className="band py-8">
            <div>
              <NewsletterCard open={false} headingId="newsletter-demo-soon-title" />
            </div>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex flex-col gap-6 border-t border-rule pt-10">
      <h2 id={`${id}-title`} className="text-heading-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubTitle({ children }: { children: ReactNode }) {
  return <h3 className="mt-4 text-heading-md">{children}</h3>;
}

function Frame({ caption, width, children }: { caption: string; width: string; children: ReactNode }) {
  return (
    <figure className={`${width} flex flex-col gap-3`}>
      {children}
      <figcaption className="text-ui text-ink-muted">{caption}</figcaption>
    </figure>
  );
}
