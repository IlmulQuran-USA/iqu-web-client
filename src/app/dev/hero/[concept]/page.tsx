import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HERO_CTAS_ID, HomeHero } from "@/components/home/HomeHero";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import type { HomeHeroLayout } from "@/content/types";
import { getHomeHero } from "@/lib/content/home-hero";
import { pageMetadata } from "@/lib/metadata";

/*
 * Development previews of the three Home hero layouts (owner decision 5),
 * driven by the same <HomeHero> and the same getHomeHero() content as /,
 * with only the layout overridden. Returns 404 in production.
 */
const concepts = {
  a: { layout: "editorial", label: "A · Editorial" },
  b: { layout: "teachers", label: "B · Teachers first (default)" },
  c: { layout: "spacious", label: "C · Spacious" },
} as const satisfies Record<string, { layout: HomeHeroLayout; label: string }>;

type ConceptKey = keyof typeof concepts;
const isConcept = (key: string): key is ConceptKey => key in concepts;

// Dev-only preview: it may block on params instead of streaming a shell
// (Next 16 instant-shell-url-data). The live page, /, has no params.
export const instant = false;

export function generateStaticParams() {
  return Object.keys(concepts).map((concept) => ({ concept }));
}

export async function generateMetadata({ params }: PageProps<"/dev/hero/[concept]">): Promise<Metadata> {
  const { concept } = await params;
  return pageMetadata({
    title: isConcept(concept) ? `Hero preview ${concepts[concept].label}` : "Hero preview",
    description: "Development preview of one of the three Home hero layouts, with the live Home content.",
    path: `/dev/hero/${concept}`,
    robots: { index: false, follow: false },
  });
}

export default async function HeroPreviewPage({ params }: PageProps<"/dev/hero/[concept]">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { concept } = await params;
  if (!isConcept(concept)) notFound();

  const hero = await getHomeHero();
  const current = concepts[concept];

  return (
    <>
      <Header yieldCtaTo={HERO_CTAS_ID} yieldOnLoad />
      <main id="main-content" className="flex flex-col">
        <HomeHero hero={hero} layout={current.layout} />
        <aside aria-label="Hero preview (dev only)" className="border-t border-rule bg-surface-2">
          <div className="container-content flex flex-col gap-4 py-8 lg:flex-row lg:items-center lg:justify-between">
            <p className="max-w-measure text-ui text-ink-muted">
              <span className="font-medium text-ink">Dev only · Layout {current.label}.</span> Same content as the home
              page, from src/content/home-hero.ts; the live layout is set there.
            </p>
            <nav aria-label="Hero layouts">
              <ul className="flex gap-1">
                {(Object.keys(concepts) as ConceptKey[]).map((key) => (
                  <li key={key}>
                    <Link
                      href={`/dev/hero/${key}`}
                      aria-current={key === concept ? "page" : undefined}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-button px-3 text-body font-medium text-ink-body underline-offset-[6px] hov:text-ink hov:underline hov:decoration-1 hov:decoration-accent-strong aria-[current=page]:text-ink aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:decoration-accent-strong"
                    >
                      Concept {key.toUpperCase()}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>
      </main>
      <Footer />
    </>
  );
}
