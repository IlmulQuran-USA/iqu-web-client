"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import {
  about,
  coursesByAge,
  coursesByLevel,
  featuredProgram,
  primaryLinks,
  programs,
  type NavLink,
} from "@/content/navigation";
import { cn } from "@/lib/cn";
import { isCurrent, isExactPage } from "@/lib/nav";
import { Logo } from "./Logo";
import { MobileNav } from "./MobileNav";

/**
 * Public header (spec §6.1).
 * - Sticky, --paper, 64 px tall (72 px from lg). The 1 px --rule bottom border appears only after
 *   40 px of scroll.
 * - Desktop: Courses ▾ (mega panel), Programs ▾, Instructors, About ▾,
 *   Donate (a --link text link, never filled), then Log in (ghost) and
 *   Start free trial (primary, the header's only filled button).
 * - The desktop row needs about 945 px (logo 229 + nav + CTAs, with gaps and nav padding tightened from lg to xl), so it appears from lg (1024). Below
 *   that the drawer takes over. The spec says md (768); see the build notes.
 * - Menus open on click, not hover, so keyboard and touch work the same way.
 *   Escape closes a menu and returns focus to its trigger, as do a click
 *   outside and focus leaving the nav.
 */

type MenuKey = "courses" | "programs" | "about";

const SCROLL_THRESHOLD = 40;

export function Header({
  yieldCtaTo,
}: {
  /**
   * Id of an on-page element holding the page's own filled CTA (the Home
   * hero). While it is on screen the header CTA drops to secondary, so only
   * one filled button is in view (CLAUDE.md §4; spec §6.1 and §7.1 each ask
   * for a filled "Start free trial").
   */
  yieldCtaTo?: string;
} = {}) {
  const pathname = usePathname() ?? "/";
  const [scrolled, setScrolled] = useState(false);
  // Start yielded when a target is named, so the server render never shows two filled CTAs.
  const [ctaYielded, setCtaYielded] = useState(Boolean(yieldCtaTo));

  useEffect(() => {
    if (!yieldCtaTo) return;
    const target = document.getElementById(yieldCtaTo);
    // Only pass yieldCtaTo on a page that renders the target.
    if (!target) return;
    // The sticky header covers the top of the viewport: 64 px below lg, 72 px from lg.
    const headerHeight = Math.round(target.ownerDocument.querySelector("header")?.getBoundingClientRect().height ?? 72);
    const observer = new IntersectionObserver(([entry]) => setCtaYielded(entry.isIntersecting), {
      rootMargin: `-${headerHeight}px 0px 0px 0px`,
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [yieldCtaTo]);
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const triggerRefs = useRef<Partial<Record<MenuKey, HTMLButtonElement | null>>>({});
  const baseId = useId();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      triggerRefs.current[openMenu]?.focus();
      setOpenMenu(null);
    };
    const onPointer = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [openMenu]);

  const close = () => setOpenMenu(null);
  const toggle = (key: MenuKey) => setOpenMenu((current) => (current === key ? null : key));
  const panelId = (key: MenuKey) => `${baseId}-${key}`;

  const groupCurrent = {
    courses: [...coursesByLevel, ...coursesByAge, { label: "", href: "/courses" }].some((l) =>
      isCurrent(pathname, l.href),
    ),
    programs: programs.some((l) => isCurrent(pathname, l.href)),
    about: about.some((l) => isCurrent(pathname, l.href)),
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-paper transition-colors duration-(--duration-default) ease-riwaq",
        scrolled || openMenu ? "border-rule" : "border-transparent",
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-button focus:bg-paper focus:px-4 focus:text-body focus:font-medium focus:text-ink focus:shadow-overlay"
      >
        Skip to main content
      </a>

      {/* --header-height (64 px, 72 px from lg): the row plus the 1 px bottom rule. */}
      <div className="container-content flex h-[calc(var(--header-height)-1px)] items-center justify-between gap-6 lg:gap-4 xl:gap-6">
        <Logo onNavigate={close} />

        <nav
          ref={navRef}
          aria-label="Main"
          className="hidden lg:block"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
          }}
        >
          <ul className="flex items-center gap-1">
            <li>
              <MenuTrigger
                label="Courses"
                expanded={openMenu === "courses"}
                current={groupCurrent.courses}
                controls={panelId("courses")}
                onToggle={() => toggle("courses")}
                buttonRef={(el) => {
                  triggerRefs.current.courses = el;
                }}
              />
              <CoursesPanel id={panelId("courses")} hidden={openMenu !== "courses"} pathname={pathname} onNavigate={close} />
            </li>
            <li className="relative">
              <MenuTrigger
                label="Programs"
                expanded={openMenu === "programs"}
                current={groupCurrent.programs}
                controls={panelId("programs")}
                onToggle={() => toggle("programs")}
                buttonRef={(el) => {
                  triggerRefs.current.programs = el;
                }}
              />
              <Dropdown id={panelId("programs")} hidden={openMenu !== "programs"} links={programs} pathname={pathname} onNavigate={close} />
            </li>
            <li>
              <TopLink href={primaryLinks.instructors.href} current={isCurrent(pathname, primaryLinks.instructors.href)} onNavigate={close}>
                {primaryLinks.instructors.label}
              </TopLink>
            </li>
            <li className="relative">
              <MenuTrigger
                label="About"
                expanded={openMenu === "about"}
                current={groupCurrent.about}
                controls={panelId("about")}
                onToggle={() => toggle("about")}
                buttonRef={(el) => {
                  triggerRefs.current.about = el;
                }}
              />
              <Dropdown id={panelId("about")} hidden={openMenu !== "about"} links={about} pathname={pathname} onNavigate={close} />
            </li>
            <li>
              <TopLink
                href={primaryLinks.donate.href}
                current={isCurrent(pathname, primaryLinks.donate.href)}
                onNavigate={close}
                tone="accent"
              >
                {primaryLinks.donate.label}
              </TopLink>
            </li>
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <ButtonLink href={primaryLinks.login.href} variant="ghost">
            {primaryLinks.login.label}
          </ButtonLink>
          <ButtonLink href={primaryLinks.enrol.href} variant={ctaYielded ? "secondary" : "primary"}>
            {primaryLinks.enrol.label}
          </ButtonLink>
        </div>

        <MobileNav pathname={pathname} className="lg:hidden" />
      </div>
    </header>
  );
}

const topItem =
  "inline-flex min-h-11 items-center gap-1 rounded-button px-2 text-body font-medium xl:px-3 " +
  "transition-colors duration-(--duration-micro) ease-riwaq underline-offset-[6px]";

// Current and open items: --ink with a 2 px --accent-strong underline
// (3.9:1, above the 3:1 needed for a state indicator). Idle items are
// --ink-body and darken to --ink on hover.
const currentMark = "text-ink underline decoration-2 decoration-accent-strong";

function MenuTrigger({
  label,
  expanded,
  current,
  controls,
  onToggle,
  buttonRef,
}: {
  label: string;
  expanded: boolean;
  current: boolean;
  controls: string;
  onToggle: () => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
      className={cn(
        topItem,
        expanded || current ? "text-ink" : "text-ink-body hov:text-ink hov:underline hov:decoration-1 hov:decoration-accent-strong",
        current && currentMark,
      )}
    >
      {label}
      <ChevronDown
        aria-hidden="true"
        strokeWidth={1.5}
        className={cn(
          "size-4 transition-transform duration-(--duration-default) ease-riwaq motion-reduce:transition-none",
          expanded && "rotate-180",
        )}
      />
    </button>
  );
}

function TopLink({
  href,
  current,
  onNavigate,
  tone = "ink",
  children,
}: {
  href: string;
  current: boolean;
  onNavigate: () => void;
  tone?: "ink" | "accent";
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        topItem,
        tone === "accent"
          ? "text-link decoration-1 hov:underline"
          : current
            ? currentMark
            : "text-ink-body hov:text-ink hov:underline hov:decoration-1 hov:decoration-accent-strong",
        current && tone === "accent" && "underline",
      )}
    >
      {children}
    </Link>
  );
}

const panelLink =
  "flex min-h-11 items-center rounded-button px-3 text-body text-ink-body " +
  "transition-colors duration-(--duration-micro) ease-riwaq hov:bg-surface hov:text-ink " +
  "hov:underline hov:decoration-1 hov:decoration-accent-strong underline-offset-4 " +
  "aria-[current=page]:bg-tint aria-[current=page]:font-medium aria-[current=page]:text-ink";

function LinkList({
  links,
  pathname,
  onNavigate,
  labelledBy,
}: {
  links: NavLink[];
  pathname: string;
  onNavigate: () => void;
  labelledBy?: string;
}) {
  return (
    <ul aria-labelledby={labelledBy} className="flex flex-col">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            onClick={onNavigate}
            aria-current={isExactPage(pathname, link.href) ? "page" : undefined}
            className={panelLink}
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Dropdown({
  id,
  hidden,
  links,
  pathname,
  onNavigate,
}: {
  id: string;
  hidden: boolean;
  links: NavLink[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div
      id={id}
      hidden={hidden}
      className="absolute top-full left-0 mt-2 w-72 rounded-card border border-rule bg-paper p-2 shadow-overlay"
    >
      <LinkList links={links} pathname={pathname} onNavigate={onNavigate} />
    </div>
  );
}

function CoursesPanel({
  id,
  hidden,
  pathname,
  onNavigate,
}: {
  id: string;
  hidden: boolean;
  pathname: string;
  onNavigate: () => void;
}) {
  const levelId = `${id}-level`;
  const ageId = `${id}-age`;
  return (
    <div id={id} hidden={hidden} className="absolute inset-x-0 top-full border-b border-rule bg-paper shadow-overlay">
      <div className="container-content grid grid-cols-12 gap-6 py-8">
        <div className="col-span-4">
          <p id={levelId} className="eyebrow px-3 pb-2">
            By level
          </p>
          <LinkList links={coursesByLevel} pathname={pathname} onNavigate={onNavigate} labelledBy={levelId} />
          <Link
            href="/courses"
            onClick={onNavigate}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-button px-3 text-body font-medium text-link underline decoration-1 underline-offset-2 hov:decoration-2"
          >
            All courses
            <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
          </Link>
        </div>

        <div className="col-span-3 border-l border-rule pl-6">
          <p id={ageId} className="eyebrow px-3 pb-2">
            By age
          </p>
          <LinkList links={coursesByAge} pathname={pathname} onNavigate={onNavigate} labelledBy={ageId} />
        </div>

        <div className="col-span-5">
          <Link
            href={featuredProgram.href}
            onClick={onNavigate}
            className="group block rounded-card border border-transparent bg-tint p-6 transition-colors duration-(--duration-default) ease-riwaq hov:border-accent-strong"
          >
            <p className="font-display text-heading-lg font-semibold text-ink">{featuredProgram.label}</p>
            <p className="mt-1 text-body font-medium text-ink">{featuredProgram.note}</p>
            <p className="mt-3 max-w-measure text-body text-ink-body">{featuredProgram.summary}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-body font-medium text-link underline decoration-1 underline-offset-2 group-hover:decoration-2">
              About the program
              <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
