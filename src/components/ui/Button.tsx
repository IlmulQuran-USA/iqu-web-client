"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

/**
 * Button system: spec §6.4 and DESIGN.md §8.
 *
 *   primary    One per view (Enrol, Save). Filled --primary.
 *   secondary  An alternative action. 1 px --primary outline.
 *   ghost      Tertiary or in-table action. Text only, underline on hover.
 *   danger     Destructive. Filled --danger, always behind a confirm dialog.
 *   link       A standalone text action ("Request a correction"). For a link
 *              inside running prose, use a plain <a> so the line box isn't padded out.
 *
 * Every variant has a hit area of at least 44 × 44 px and the global focus
 * ring. While loading, the spinner replaces the label, the width stays fixed
 * and clicks are swallowed, so a form is never submitted twice.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
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
  "relative inline-flex min-h-11 min-w-11 items-center justify-center gap-2 font-sans font-medium " +
  "transition-[color,background-color,border-color,text-decoration-color] duration-(--duration-micro) ease-riwaq " +
  "disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "rounded-button bg-primary text-on-primary hov:not-disabled:bg-primary-hover act:not-disabled:bg-primary-active " +
    "disabled:bg-surface disabled:text-ink-muted",
  secondary:
    "rounded-button border border-primary text-primary hov:not-disabled:bg-surface act:not-disabled:bg-rule " +
    "disabled:border-rule disabled:text-ink-muted",
  ghost:
    "rounded-button text-primary decoration-1 underline-offset-4 hov:not-disabled:underline " +
    "act:not-disabled:text-primary-active act:not-disabled:underline disabled:text-ink-muted",
  danger:
    "rounded-button bg-danger text-on-primary hov:not-disabled:bg-danger-hover act:not-disabled:bg-danger-active " +
    "disabled:bg-surface disabled:text-ink-muted",
  link:
    "rounded-chip text-primary underline decoration-1 underline-offset-2 hov:not-disabled:decoration-2 " +
    "act:not-disabled:text-primary-active disabled:text-ink-muted disabled:decoration-rule",
};

const sizes: Record<ButtonVariant, Record<ButtonSize, string>> = {
  primary: { md: "px-5 py-2.5 text-body", lg: "min-h-13 px-6 py-3 text-body-lg" },
  secondary: { md: "px-5 py-2.5 text-body", lg: "min-h-13 px-6 py-3 text-body-lg" },
  danger: { md: "px-5 py-2.5 text-body", lg: "min-h-13 px-6 py-3 text-body-lg" },
  ghost: { md: "px-3 py-2.5 text-body", lg: "min-h-13 px-4 py-3 text-body-lg" },
  link: { md: "px-0.5 py-2.5 text-body", lg: "min-h-13 px-0.5 py-3 text-body-lg" },
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
