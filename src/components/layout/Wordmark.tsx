import Link from "next/link";
import { site } from "@/content/site";
import { cn } from "@/lib/cn";

/**
 * Typographic lockup. It stands in for the logo, which has not been supplied
 * yet (PRODUCT.md "Evidence on Hand"). It sets the name only and invents no emblem.
 *
 * On light surfaces the name is --ink and "USA" is coral text in --link
 * (5.4:1; --accent would be 2.9:1). On --band the name is white and "USA" is
 * --accent (6.2:1).
 */
export function Wordmark({
  className,
  onNavigate,
  tone = "light",
}: {
  className?: string;
  onNavigate?: () => void;
  tone?: "light" | "band";
}) {
  return (
    <Link
      href="/"
      aria-label={`${site.name}, home`}
      onClick={onNavigate}
      className={cn(
        "inline-flex min-h-11 items-center rounded-chip whitespace-nowrap",
        tone === "band" ? "text-on-band" : "text-ink",
        className,
      )}
    >
      <span translate="no" className="inline-flex items-baseline gap-1.5">
        <span className="font-display text-heading-lg font-semibold tracking-tight">Ilm-ul-Quran</span>
        <span className={cn("eyebrow", tone === "band" ? "text-accent" : "text-link")}>USA</span>
      </span>
    </Link>
  );
}
