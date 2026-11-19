"use client";

import { ArrowRight, ChevronDown, Menu, UserRound, X } from "lucide-react";
import Link from "next/link";
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
import { DonateButton } from "./DonateButton";
import { Logo } from "./Logo";

/**
 * MobileDrawer (spec §6.1 "Mobile").
 * - Hamburger on the right. The drawer slides in from the right at full height.
 * - Courses, Programs and About are accordion sections. Instructors is a
 *   plain link.
 * - Pinned to the bottom, full width: Donate, Log in, Start free trial.
 * - Built on a native modal <dialog>, which gives a focus trap, an inert
 *   background, a top layer and Escape to close. Focus goes back to the
 *   hamburger when the drawer closes. A click on the backdrop also closes it.
 * - Reduced motion: the drawer fades instead of sliding (globals.css .drawer).
 */
export function MobileNav({ pathname, className }: { pathname: string; className?: string }) {
  const [open, setOpen] = useState(false);
  // The drawer's Donate plays its 3 laps the first time the drawer opens, not on every open.
  const [opened, setOpened] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const titleId = `${dialogId}-title`;

  const openDrawer = () => {
    dialogRef.current?.showModal();
    // Start on Close, not the home link, so a stray Enter can't navigate away.
    closeRef.current?.focus();
    setOpen(true);
    setOpened(true);
  };
  const closeDrawer = () => dialogRef.current?.close();

  // The desktop nav takes over at lg; never leave a modal open behind it.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 64rem)");
    const onChange = () => {
      if (query.matches) dialogRef.current?.close();
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={openDrawer}
        className="inline-flex size-11 items-center justify-center rounded-button text-ink transition-colors duration-(--duration-micro) ease-riwaq hov:bg-surface-2"
      >
        <Menu aria-hidden="true" strokeWidth={1.5} className="size-6" />
        <span className="sr-only">Open menu</span>
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={titleId}
        className="drawer"
        onClose={() => {
          setOpen(false);
          triggerRef.current?.focus();
        }}
        onClick={(event) => {
          // Only the backdrop targets the dialog itself; the content fills it.
          if (event.target === event.currentTarget) closeDrawer();
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-(--header-height) shrink-0 items-center justify-between gap-4 border-b border-rule px-4">
            <h2 id={titleId} className="sr-only">
              Menu
            </h2>
            <Logo onNavigate={closeDrawer} />
            <button
              ref={closeRef}
              type="button"
              onClick={closeDrawer}
              className="inline-flex size-11 items-center justify-center rounded-button text-ink transition-colors duration-(--duration-micro) ease-riwaq hov:bg-surface-2"
            >
              <X aria-hidden="true" strokeWidth={1.5} className="size-6" />
              <span className="sr-only">Close menu</span>
            </button>
          </div>

          <nav aria-label="Main" className="flex-1 overflow-y-auto overscroll-contain px-4 py-2">
            <ul className="flex flex-col divide-y divide-rule">
              <li>
                <Section
                  label="Courses"
                  current={[...coursesByLevel, ...coursesByAge, { label: "", href: "/courses" }].some((l) => isCurrent(pathname, l.href))}
                >
                  <p className="eyebrow px-3 pt-1 pb-1">By level</p>
                  <DrawerLinks links={coursesByLevel} pathname={pathname} onNavigate={closeDrawer} />
                  <p className="eyebrow px-3 pt-4 pb-1">By age</p>
                  <DrawerLinks links={coursesByAge} pathname={pathname} onNavigate={closeDrawer} />
                  <Link
                    href="/courses"
                    onClick={closeDrawer}
                    className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-button px-3 text-body font-medium text-link underline decoration-1 underline-offset-2"
                  >
                    All courses
                    <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
                  </Link>
                  <Link
                    href={featuredProgram.href}
                    onClick={closeDrawer}
                    className="mt-3 mb-2 block rounded-card bg-tint p-4"
                  >
                    <span className="block font-display text-heading-md font-semibold text-ink">
                      {featuredProgram.label}
                    </span>
                    <span className="mt-1 block text-ui text-ink-body">{featuredProgram.summary}</span>
                    <span className="mt-2 block text-ui font-medium text-ink">{featuredProgram.note}</span>
                  </Link>
                </Section>
              </li>
              <li>
                <Section label="Programs" current={programs.some((l) => isCurrent(pathname, l.href))}>
                  <DrawerLinks links={programs} pathname={pathname} onNavigate={closeDrawer} />
                </Section>
              </li>
              <li>
                <PlainLink href={primaryLinks.instructors.href} pathname={pathname} onNavigate={closeDrawer}>
                  {primaryLinks.instructors.label}
                </PlainLink>
              </li>
              <li>
                <Section label="About" current={about.some((l) => isCurrent(pathname, l.href))}>
                  <DrawerLinks links={about} pathname={pathname} onNavigate={closeDrawer} />
                </Section>
              </li>
            </ul>
          </nav>

          {/* Pinned actions, top to bottom: Donate · Log in · Start free trial (owner
              decision, 19 Nov 2026). Donate is full width, the same size as Log in. */}
          <div className="flex shrink-0 flex-col gap-2 border-t border-rule bg-paper px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {/* The same Donate button as the header. Remounted when the drawer
                first opens, so its 3 laps play once, when it can be seen. */}
            <DonateButton
              key={opened ? "shown" : "hidden"}
              href={primaryLinks.donate.href}
              label={primaryLinks.donate.label}
              current={isCurrent(pathname, primaryLinks.donate.href)}
              onNavigate={closeDrawer}
              className="w-full"
            />
            <ButtonLink
              href={primaryLinks.login.href}
              variant="tonal"
              fullWidth
              onClick={closeDrawer}
              iconStart={<UserRound aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />}
            >
              {primaryLinks.login.label}
            </ButtonLink>
            <ButtonLink href={primaryLinks.enrol.href} variant="primary" fullWidth onClick={closeDrawer}>
              {primaryLinks.enrol.label}
            </ButtonLink>
          </div>
        </div>
      </dialog>
    </div>
  );
}

// Current section or page: --ink with a 2 px --accent-strong underline (3.9:1),
// the same marker the desktop header uses.
const currentMark = "text-ink underline decoration-2 decoration-accent-strong underline-offset-[6px]";

const rowClass =
  "flex min-h-13 w-full items-center justify-between gap-3 rounded-button px-3 text-body-lg font-medium " +
  "transition-colors duration-(--duration-micro) ease-riwaq";

/** Starts open when it contains the current page, so the drawer shows where you are. */
function Section({ label, current, children }: { label: string; current: boolean; children: ReactNode }) {
  const [expanded, setExpanded] = useState(current);
  const regionId = useId();
  return (
    <div className="py-1">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={regionId}
        onClick={() => setExpanded((v) => !v)}
        className={cn(rowClass, current ? currentMark : "text-ink", "hov:bg-surface-2")}
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.5}
          className={cn("size-5 transition-transform duration-(--duration-default) ease-riwaq motion-reduce:transition-none", expanded && "rotate-180")}
        />
      </button>
      <div id={regionId} hidden={!expanded} className="pb-2">
        {children}
      </div>
    </div>
  );
}

function PlainLink({
  href,
  pathname,
  onNavigate,
  children,
}: {
  href: string;
  pathname: string;
  onNavigate: () => void;
  children: ReactNode;
}) {
  const current = isCurrent(pathname, href);
  return (
    <div className="py-1">
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={current ? "page" : undefined}
        className={cn(rowClass, current ? currentMark : "text-ink", "hov:bg-surface-2")}
      >
        {children}
      </Link>
    </div>
  );
}

function DrawerLinks({
  links,
  pathname,
  onNavigate,
}: {
  links: NavLink[];
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <ul className="flex flex-col">
      {links.map((link) => {
        const current = isExactPage(pathname, link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={onNavigate}
              aria-current={current ? "page" : undefined}
              className="flex min-h-11 items-center rounded-button px-3 text-body text-ink-body transition-colors duration-(--duration-micro) ease-riwaq hov:bg-surface hov:text-ink hov:underline hov:decoration-1 hov:decoration-accent-strong underline-offset-4 aria-[current=page]:bg-tint aria-[current=page]:font-medium aria-[current=page]:text-ink"
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
