import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

/*
 * Placeholder. Home page content (spec §7.1) is not built yet; this keeps the
 * route on the design system instead of the create-next-app template.
 */
export default function HomePage() {
  return (
    <>
      <Header />
      <main id="main-content" className="container-content py-16 md:py-24">
        <h1 className="text-display-md md:text-display-lg">Ilm-ul-Quran USA</h1>
        <p className="mt-4 max-w-measure text-body-lg text-ink-muted">
          The new site is being built. In development, see the{" "}
          <Link href="/dev/components" className="text-primary underline decoration-1 underline-offset-2">
            component reference
          </Link>
          .
        </p>
      </main>
      <Footer />
    </>
  );
}
