import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FamiliesSection } from "@/components/home/FamiliesSection";
import { homeTestimonialIds, testimonials } from "@/content/testimonials";

export const metadata: Metadata = {
  title: "Dev · What families say",
  robots: { index: false, follow: false },
};

/**
 * Development preview of Home §7 with the three chosen testimonials shown as
 * if verified, so the layout can be checked before the owner verifies them.
 * On Home they render only once their status is "live". 404 in production.
 */
export default function FamiliesPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const preview = homeTestimonialIds.map((id) => testimonials.find((t) => t.id === id)!);
  return (
    <main id="main-content" className="py-8">
      <p className="container-content text-ui text-ink-muted">
        Preview only: these testimonials are pending verification and do not render on Home.
      </p>
      <FamiliesSection items={preview} />
    </main>
  );
}
