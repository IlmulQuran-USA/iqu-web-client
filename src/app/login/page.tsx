import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AuthLayout, PreviewLabel } from "@/components/portal/AuthLayout";
import { LoginForm } from "@/components/portal/LoginForm";
import { pageMetadata } from "@/lib/metadata";
import { portalAuth } from "@/lib/site-env";

/*
 * /login (spec §7D.2, wireframe §14; portal Batch 1). Open only where the
 * portal is (src/lib/site-env.ts): dev with the four preview accounts today;
 * production once PORTAL_DATA=live and Clerk are connected. Signed-in
 * visitors never see it: the proxy sends them to their own home. Never
 * indexed, never in the sitemap.
 */

export const instant = false;

export const metadata = pageMetadata({
  title: "Log in",
  description: "Sign in to your Ilm-Ul-Quran USA account: classes, progress, reports and billing for your family.",
  path: "/login",
  robots: { index: false, follow: false },
});

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Per request: the portal flag is read at runtime, and ?next= / ?signed-out= change the page.
  await connection();
  const provider = portalAuth();
  if (!provider) notFound();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const next = one(sp.next);
  const notice = one(sp["signed-out"]) ? "signed-out" : next ? "signin-needed" : null;

  return (
    <AuthLayout tag={provider === "preview" ? <PreviewLabel /> : undefined}>
      <h1 className="font-display text-display-md font-medium text-balance text-ink">Welcome back</h1>
      <p className="mt-3 text-body-lg text-ink-body">Sign in to see classes, progress and billing.</p>
      <div className="mt-8">
        <LoginForm next={next} notice={notice} />
      </div>
    </AuthLayout>
  );
}
