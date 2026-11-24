import { ConfirmationView } from "@/components/enroll/ConfirmationView";
import { EnrollFooter, EnrollHeader } from "@/components/enroll/frame";
import { parseConfirmation } from "@/lib/enroll/confirmation";
import { pageMetadata } from "@/lib/metadata";

/*
 * /enroll/confirmation (spec §7.17 "Confirmation"; plan B3.6). Reached from
 * the /enroll server action, or from Stripe's success URL that the plugin
 * builds (C6). Never indexed. The URL holds only the state, the IQU
 * reference and the Meta event fields.
 */

export const instant = false;

export const metadata = pageMetadata({
  title: "Enrollment received",
  description: "Your enrollment with Ilm-Ul-Quran USA, your reference and what happens next.",
  path: "/enroll/confirmation",
  robots: { index: false, follow: false },
});

export default async function ConfirmationPage({ searchParams }: PageProps<"/enroll/confirmation">) {
  const confirmation = parseConfirmation(await searchParams);
  return (
    <>
      <EnrollHeader />
      <main id="main-content" className="container-content flex-1 py-12 sm:py-16">
        <ConfirmationView confirmation={confirmation} />
      </main>
      <EnrollFooter />
    </>
  );
}
