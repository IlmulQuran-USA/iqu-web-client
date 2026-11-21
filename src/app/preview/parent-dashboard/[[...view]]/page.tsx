import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AllChildren, ChildDashboard, childHref } from "@/components/portal/ParentDashboard";
import { PortalShell } from "@/components/portal/PortalShell";
import { childById, parentDashboardSample as family } from "@/content/sample-parent";
import { pageMetadata } from "@/lib/metadata";

/*
 * /preview/parent-dashboard: the parent dashboard as it will really be
 * (spec §7D.4), with sample data, for admin review (owner, 21 Nov 2026).
 * It becomes the starting point of the parent portal (/p/*).
 *   /preview/parent-dashboard           the first child
 *   /preview/parent-dashboard/<child>   another child
 *   /preview/parent-dashboard/all       every child (spec "All children")
 * noindex: never in search.
 */

export async function generateMetadata({ params }: PageProps<"/preview/parent-dashboard/[[...view]]">): Promise<Metadata> {
  const { view = [] } = await params;
  return pageMetadata({
    title: "Parent dashboard (preview)",
    description:
      "A preview of the parent dashboard with sample data: each child’s classes, attendance and progress in one place.",
    path: ["/preview/parent-dashboard", ...view].join("/"),
    robots: { index: false, follow: false },
  });
}

export function generateStaticParams() {
  return [{ view: [] }, ...family.children.slice(1).map((c) => ({ view: [c.id] })), { view: ["all"] }];
}

export default async function ParentDashboardPreview({ params }: PageProps<"/preview/parent-dashboard/[[...view]]">) {
  const { view = [] } = await params;
  if (view.length > 1) notFound();
  const id = view[0];
  const all = id === "all";
  const child = all ? undefined : (childById(id) ?? (id === undefined ? family.children[0] : undefined));
  if (!all && !child) notFound();

  const switcher = [
    ...family.children.map((c) => ({ label: c.name, href: childHref(c.id), current: c.id === child?.id })),
    { label: "All children", href: "/preview/parent-dashboard/all", current: all },
  ];

  return (
    <PortalShell title={child ? `${child.name} · Overview` : "All children · Overview"} switcher={switcher} account={family.parentName} unread={1}>
      {child ? <ChildDashboard child={child} /> : <AllChildren />}
    </PortalShell>
  );
}
