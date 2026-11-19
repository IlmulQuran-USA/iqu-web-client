"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

/**
 * Button system: spec §6.4 and DESIGN.md §8.
 *
 *   primary    One per view (Enrol, Save). Filled --primary (slate), white label.
 *   secondary  An alternative action. 1 px --ink-body outline and label.
 *   ghost      Tertiary or in-table action. --ink text only, underline on hover.
 *   tonal      A quiet utility action (Log in): --surface fill, --ink label, no
 *              visible border; --rule on hover. Never the page's primary action.
 *   danger     Destructive. Filled --danger, white label, always behind a
 *              confirm dialog.
 *   link       A standalone text action ("Request a correction"), in --link.
 *              For a link inside running prose, use a plain <a> so the line
 *              box isn't padded out.
 *   band       The primary action on the dark --band: coral fill, --ink label.
 *              On a light surface only as the newsletter Subscribe inside its
 *              own white card (owner decision, 20 Nov 2026; CLAUDE.md §4).
 *
 * Every variant except link has a 1 px border (transparent on filled and tonal variants),
 * border-box sizing and an explicit height per size (md 44 px, lg 52 px for
 * hero CTAs), so a border never changes a button's size (owner decision,
 * 19 Nov 2026). Every variant has a hit area of at least 44 × 44 px and the global focus
 * ring. While loading, the spinner replaces the label, the width stays fixed
 * and clicks are swallowed, so a form is never submitted twice.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "tonal" | "danger" | "link" | "band";
export type ButtonSize = "md" | "lg";

type StyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width, e.g. the CTAs pinned in the mobile drawer. */
  fullWidth?: boolean;
  className?: string;
};

type ContentProps = {
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  children: ReactNode;
};

const base =
  "relative box-border inline-flex min-h-11 min-w-11 items-center justify-center gap-2 font-sans font-medium " +
  "transition-[color,background-color,border-color,text-decoration-color] duration-(--duration-micro) ease-riwaq " +
  "disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "rounded-button border border-transparent bg-primary text-on-primary hov:not-disabled:bg-primary-hover act:not-disabled:bg-primary-active " +
    "disabled:bg-surface disabled:text-ink-muted",
  secondary:
    "rounded-button border border-ink-body text-ink-body hov:not-disabled:bg-ink/6 act:not-disabled:bg-ink/12 " +
    "disabled:border-rule disabled:text-ink-muted",
  ghost:
    "rounded-button border border-transparent text-ink decoration-1 underline-offset-4 hov:not-disabled:underline " +
    "act:not-disabled:text-ink-body act:not-disabled:underline disabled:text-ink-muted",
  tonal:
    "rounded-button border border-transparent bg-surface text-ink hov:not-disabled:bg-rule act:not-disabled:bg-rule " +
    "disabled:text-ink-muted",
  danger:
    "rounded-button border border-transparent bg-danger text-on-primary hov:not-disabled:bg-danger-hover act:not-disabled:bg-danger-active " +
    "disabled:bg-surface disabled:text-ink-muted",
  link:
    "rounded-chip text-link underline decoration-1 underline-offset-2 hov:not-disabled:decoration-2 " +
    "act:not-disabled:text-ink disabled:text-ink-muted disabled:decoration-rule",
  // --ink on --accent 6.2:1, on --accent-hover 7.4:1, pressed on --accent-strong 4.6:1.
  band:
    "rounded-button border border-transparent bg-accent text-ink hov:not-disabled:bg-accent-hover act:not-disabled:bg-accent-strong " +
    "disabled:bg-ink-body disabled:text-on-band-muted",
};

const sizes: Record<ButtonVariant, Record<ButtonSize, string>> = {
  primary: { md: "h-11 px-5 text-body", lg: "h-13 px-6 text-body-lg" },
  secondary: { md: "h-11 px-5 text-body", lg: "h-13 px-6 text-body-lg" },
  danger: { md: "h-11 px-5 text-body", lg: "h-13 px-6 text-body-lg" },
  ghost: { md: "h-11 px-3 text-body", lg: "h-13 px-4 text-body-lg" },
  tonal: { md: "h-11 px-4 text-body", lg: "h-13 px-5 text-body-lg" },
  link: { md: "px-0.5 py-2.5 text-body", lg: "min-h-13 px-0.5 py-3 text-body-lg" },
  band: { md: "h-11 px-5 text-body", lg: "h-13 px-6 text-body-lg" },
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: StyleProps = {}): string {
  return cn(
    base,
    variants[variant],
    sizes[variant][size],
    fullWidth ? "w-full text-center text-balance" : "whitespace-nowrap",
    className,
  );
}

function Content({ iconStart, iconEnd, children }: ContentProps) {
  return (
    <>
      {iconStart}
      {children}
      {iconEnd}
    </>
  );
}

export type ButtonProps = StyleProps &
  ContentProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof StyleProps | keyof ContentProps> & {
    loading?: boolean;
    /** What a screen reader hears while loading, e.g. "Saving". */
    loadingLabel?: string;
  };

export function Button({
  variant,
  size,
  fullWidth,
  className,
  iconStart,
  iconEnd,
  children,
  loading = false,
  loadingLabel = "Please wait",
  type = "button",
  onClick,
  ...rest
}: ButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      // Keep focus on the button but refuse a second submit.
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      type={type}
      onClick={handleClick}
      aria-disabled={loading || rest["aria-disabled"] || undefined}
      aria-busy={loading || undefined}
      className={buttonClasses({
        variant,
        size,
        fullWidth,
        className: cn(loading && "cursor-progress", className),
      })}
    >
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>
        <Content iconStart={iconStart} iconEnd={iconEnd}>
          {children}
        </Content>
      </span>
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
          <span className="sr-only">{loadingLabel}</span>
        </span>
      ) : null}
    </button>
  );
}

export type ButtonLinkProps = StyleProps &
  ContentProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, keyof StyleProps | keyof ContentProps>;

/** Navigation styled as a button, e.g. "Start free trial" → /enroll. */
export function ButtonLink({
  variant,
  size,
  fullWidth,
  className,
  iconStart,
  iconEnd,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link {...rest} className={buttonClasses({ variant, size, fullWidth, className })}>
      <Content iconStart={iconStart} iconEnd={iconEnd}>
        {children}
      </Content>
    </Link>
  );
}
