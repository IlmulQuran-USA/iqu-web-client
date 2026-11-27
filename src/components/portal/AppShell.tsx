import { Activity, CalendarClock, LayoutDashboard, LifeBuoy, LogOut, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/layout/Logo";
import type { Area } from "@/lib/auth/access";
import { cn } from "@/lib/cn";

/**
 * The portal shell for every role (spec §7D.1; plan §8). Generalises the
 * parent preview's PortalShell (kept as it is for /preview/parent-dashboard):
 *   - sidebar 264 px on --surface from lg, with only the destinations that
 *     exist for this role (each batch adds its own), help and sign out;
 *   - topbar 64 px: the area, the page title, the "Preview · sample data"
 *     label on dev (owner answer 2), the account;
 *   - content up to 1200 px with 32 px padding;
 *   - phones: the topbar keeps the account and sign out; a bottom tab bar
 *     appears once a role has two or more destinations.
 * Sign out is a form POST (a server action), never a link.
 */

type NavItem = { label: string; href: string; icon: LucideIcon };

/** Built destinations per area (Batch 1: each role's home). */
export const AREA_NAV: Record<Area, NavItem[]> = {
  a: [{ label: "Live board", href: "/a/live", icon: Activity }],
  t: [{ label: "Today", href: "/t/today", icon: CalendarClock }],
  p: [{ label: "Overview", href: "/p/overview", icon: LayoutDashboard }],
  s: [{ label: "Overview", href: "/s/overview", icon: LayoutDashboard }],
};

export const AREA_NAME: Record<Area, string> = { a: "Admin", t: "Teacher portal", p: "Parent portal", s: "Student portal" };

export function AppShell({
  area,
  title,
  current,
  account,
  preview,
  children,
}: {
  area: Area;
  title: string;
  /** The current page's href, for aria-current. */
  current: string;
  account: { name: string; email: string };
  /** Mock data: shows the "Preview · sample data" label. */
  preview: boolean;
  children: ReactNode;
}) {
  const nav = AREA_NAV[area];
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[16.5rem_1fr]">
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-button focus:bg-paper focus:px-4 focus:py-3"
      >
        Skip to content
      </a>

      <div className="hidden border-r border-rule bg-surface lg:block">
        <aside className="sticky top-0 flex h-dvh flex-col">
          <div className="flex h-16 items-center px-5">
            <Logo />
          </div>
          <nav aria-label={AREA_NAME[area]} className="flex-1 px-3 py-4">
            <ul className="flex flex-col gap-1">
              {nav.map((item) => (
                <li key={item.href}>
                  <SideLink item={item} current={item.href === current} />
                </li>
              ))}
            </ul>
          </nav>
          <div className="border-t border-rule px-3 py-4">
            <p className="px-3 text-ui font-medium text-ink">{account.name}</p>
            <p className="truncate px-3 text-ui-xs text-ink-muted">{account.email}</p>
            <ul className="mt-3 flex flex-col gap-1">
              <li>
                <SideLink item={{ label: "Help", href: "/faq", icon: LifeBuoy }} />
              </li>
              <li>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex min-h-11 w-full items-center gap-3 rounded-button px-3 text-body font-medium text-ink-body transition-colors duration-(--duration-micro) ease-riwaq hov:bg-paper/70 hov:text-ink"
                  >
                    <LogOut aria-hidden="true" strokeWidth={1.5} className="size-5 shrink-0 text-ink-muted" />
                    Sign out
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <div className={cn("flex min-w-0 flex-col", nav.length > 1 && "pb-20 lg:pb-0")}>
        <header className="sticky top-0 z-30 border-b border-rule bg-paper">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="lg:hidden">
                <Logo />
              </span>
              <p className="hidden min-w-0 truncate text-ui text-ink-muted sm:block">
                {AREA_NAME[area]} · <span className="font-medium text-ink">{title}</span>
              </p>
            </div>
            {preview ? <PreviewTag /> : null}
            <span
              aria-hidden="true"
              title={account.name}
              className="hidden size-9 shrink-0 items-center justify-center rounded-pill bg-surface font-display text-body font-semibold text-ink-body sm:flex lg:hidden"
            >
              {account.name.charAt(0)}
            </span>
            <form action={signOut} className="lg:hidden">
              <button
                type="submit"
                className="inline-flex size-11 items-center justify-center rounded-button text-ink transition-colors duration-(--duration-micro) ease-riwaq hov:bg-surface-2"
              >
                <LogOut aria-hidden="true" strokeWidth={1.5} className="size-5" />
                <span className="sr-only">Sign out ({account.name})</span>
              </button>
            </form>
          </div>
        </header>

        <main id="portal-main" className="mx-auto w-full max-w-300 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      {nav.length > 1 ? (
        <nav
          aria-label={AREA_NAME[area]}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(nav.length, 5)}, minmax(0, 1fr))` }}>
            {nav.slice(0, 5).map((item) => {
              const Icon = item.icon;
              const active = item.href === current;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn("flex min-h-14 flex-col items-center justify-center gap-1 text-ui-xs font-medium", active ? "text-ink" : "text-ink-muted")}
                  >
                    <Icon aria-hidden="true" strokeWidth={1.5} className={cn("size-5", active && "text-accent-strong")} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}

/** Dev only (owner answer 2): mock families must never be mistaken for real ones in a screenshot. */
function PreviewTag() {
  return (
    <span className="inline-flex min-h-7 shrink-0 items-center rounded-chip bg-info-tint px-2.5 text-ui-xs font-medium text-info">
      Preview · sample data
    </span>
  );
}

function SideLink({ item, current = false }: { item: NavItem; current?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-button px-3 text-body font-medium transition-colors duration-(--duration-micro) ease-riwaq",
        current ? "bg-paper text-ink shadow-card" : "text-ink-body hov:bg-paper/70 hov:text-ink",
      )}
    >
      <Icon aria-hidden="true" strokeWidth={1.5} className={cn("size-5 shrink-0", current ? "text-accent-strong" : "text-ink-muted")} />
      {item.label}
    </Link>
  );
}
