import { HERO_CTAS_ID, HomeHero } from "@/components/home/HomeHero";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { getHomeHero } from "@/lib/content/home-hero";

/*
 * Home (spec §7.1). Section 1, the hero, reads its content only through
 * getHomeHero(). Sections 2–9 are not built yet.
 */
export default async function HomePage() {
  const hero = await getHomeHero();

  return (
    <>
      <Header yieldCtaTo={HERO_CTAS_ID} />
      <main id="main-content" className="flex flex-col">
        <HomeHero hero={hero} />
      </main>
      <Footer />
    </>
  );
}
