import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AuthLayout, PreviewLabel } from "@/components/portal/AuthLayout";
import { ResetForm } from "@/components/portal/ResetForm";
import { pageMetadata } from "@/lib/metadata";
import { portalAuth } from "@/lib/site-env";

/* /forgot-password (spec §7D.2): the reset request. Open only where the portal is; never indexed. */

// Decided per request (the portal flag is read at runtime), never frozen at build.
export const instant = false;

export const metadata = pageMetadata({
  title: "Reset your password",
  description: "Ask for a link to set a new password for your Ilm-Ul-Quran USA account.",
  path: "/forgot-password",
  robots: { index: false, follow: false },
});

export default async function ForgotPasswordPage() {
  await connection();
  const provider = portalAuth();
  if (!provider) notFound();
  return (
    <AuthLayout tag={provider === "preview" ? <PreviewLabel /> : undefined}>
      <h1 className="font-display text-display-md font-medium text-balance text-ink">Reset your password</h1>
      <p className="mt-3 text-body-lg text-ink-body">We’ll email you a link to set a new one.</p>
      <div className="mt-8">
        <ResetForm />
      </div>
    </AuthLayout>
  );
}
