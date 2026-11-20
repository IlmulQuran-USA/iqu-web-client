import {
  Bell,
  CalendarCheck,
  CreditCard,
  Ellipsis,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/cn";

/**
 * Portal shell (spec §7D.1), parent role (§7D.4): a 264 px --surface sidebar
 * from lg, a 64 px topbar with the child switcher, notifications and the
 * account menu, and content up to 1200 px with 32 px padding. Below lg the
 * sidebar becomes a bottom tab bar of five destinations (the rest under
 * "More") and the child switcher scrolls sideways under the topbar.
 *
 * Built for /preview/parent-dashboard (owner, 21 Nov 2026); it becomes the
 * shell of the parent portal (/p/*). The navigation already points at the
 * portal routes, which are not built yet.
 */

type NavItem = { label: string; href: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { label: "Overview", href: "/p/overview", icon: LayoutDashboard },
  { label: "Attendance", href: "/p/attendance", icon: CalendarCheck },
  { label: "Reports", href: "/p/reports", icon: FileText },
  { label: "Billing", href: "/p/billing", icon: CreditCard },
  { label: "Messages", href: "/p/messages", icon: MessageSquare },
];

/** Bottom tab bar on phones: four destinations, then More. */
const TABS: NavItem[] = [
  ...NAV.slice(0, 4),
  { label: "More", href: "/p/more", icon: Ellipsis },
];

export type SwitcherItem = { label: string; href: string; current: boolean };

export function PortalShell({
  title,
  current = "Overview",
  switcher,
  account,
  unread = 0,
  children,
}: {
  /** The page title in the topbar. */
  title: string;
  current?: string;
  switcher: SwitcherItem[];
  /** The signed-in parent's name, for the account menu. */
  account: string;
  unread?: number;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[16.5rem_1fr]">
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-button focus:bg-paper focus:px-4 focus:py-3"
      >
        Skip to content
      </a>

      {/* Sidebar, lg and up: the column carries the --surface ground for the full page height; the panel inside sticks. */}
      <div className="hidden border-r border-rule bg-surface lg:block">
        <aside className="sticky top-0 flex h-dvh flex-col">
          <div className="flex h-16 items-center px-5">
            <Logo />
          </div>
          <nav aria-label="Parent portal" className="flex-1 px-3 py-4">
            <ul className="flex flex-col gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <SideLink item={item} current={item.label === current} />
                </li>
              ))}
            </ul>
          </nav>
          <ul className="flex flex-col gap-1 border-t border-rule px-3 py-4">
            <li>
              <SideLink
                item={{ label: "Help", href: "/p/help", icon: LifeBuoy }}
              />
            </li>
            <li>
              <SideLink
                item={{ label: "Sign out", href: "/logout", icon: LogOut }}
              />
            </li>
          </ul>
        </aside>
      </div>

      <div className="flex min-w-0 flex-col pb-20 lg:pb-0">
        {/* Topbar: 64 px. */}
        <header className="sticky top-0 z-30 border-b border-rule bg-paper">
          <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8">
            <div className="min-w-0 flex-1">
              <p className="truncate text-ui text-ink-muted">
                <span className="hidden sm:inline">Parent portal · </span>
                <span className="font-medium text-ink">{title}</span>
              </p>
            </div>
            <Switcher items={switcher} className="hidden md:flex" />
            <Link
              href="/p/notifications"
              className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-button text-ink transition-colors duration-(--duration-micro) ease-riwaq hov:bg-surface-2"
            >
              <Bell aria-hidden="true" strokeWidth={1.5} className="size-5" />
              {unread > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute top-2.5 right-2.5 size-2 rounded-pill bg-accent ring-2 ring-paper"
                />
              ) : null}
              <span className="sr-only">
                {unread > 0
                  ? `Notifications, ${unread} unread`
                  : "Notifications"}
              </span>
            </Link>
            <Link
              href="/p/settings"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill"
              aria-label={`Account: ${account}`}
            >
              <span className="flex size-9 items-center justify-center rounded-pill bg-surface font-display text-body font-semibold text-ink-body">
                {account.charAt(0)}
              </span>
            </Link>
          </div>
          {/* Phones and small tablets: the child switcher under the topbar. */}
          <div className="border-t border-rule px-4 py-2 sm:px-6 md:hidden">
            <Switcher items={switcher} />
          </div>
        </header>

        <main
          id="portal-main"
          className="mx-auto w-full max-w-300 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>

      {/* Bottom tab bar, below lg. */}
      <nav
        aria-label="Parent portal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {TABS.map((item) => {
            const active = item.label === current;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 text-ui-xs font-medium",
                    active ? "text-ink" : "text-ink-muted",
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className={cn("size-5", active && "text-accent-strong")}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function SideLink({
  item,
  current = false,
}: {
  item: NavItem;
  current?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-button px-3 text-body font-medium transition-colors duration-(--duration-micro) ease-riwaq",
        current
          ? "bg-paper text-ink shadow-card"
          : "text-ink-body hov:bg-paper/70 hov:text-ink",
      )}
    >
      <Icon
        aria-hidden="true"
        strokeWidth={1.5}
        className={cn(
          "size-5 shrink-0",
          current ? "text-accent-strong" : "text-ink-muted",
        )}
      />
      {item.label}
    </Link>
  );
}

/** Child switcher (spec §7D.4): every child plus "All children". */
function Switcher({
  items,
  className,
}: {
  items: SwitcherItem[];
  className?: string;
}) {
  return (
    <nav aria-label="Choose a child" className={cn("flex", className)}>
      <ul className="flex gap-1 overflow-x-auto rounded-button bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-chip px-3 text-ui font-medium whitespace-nowrap transition-colors duration-(--duration-micro) ease-riwaq",
                item.current
                  ? "bg-paper text-ink shadow-card"
                  : "text-ink-muted hov:text-ink",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
