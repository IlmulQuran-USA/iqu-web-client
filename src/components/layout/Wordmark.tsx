import Link from "next/link";
import { site } from "@/content/site";
import { cn } from "@/lib/cn";

/**
 * Typographic lockup. It stands in for the logo, which has not been supplied
 * yet (PRODUCT.md "Evidence on Hand"). It sets the name only and invents no emblem.
 */
export function Wordmark({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      aria-label={`${site.name}, home`}
      onClick={onNavigate}
      className={cn(
        "inline-flex min-h-11 items-center rounded-chip whitespace-nowrap text-primary",
        className,
      )}
    >
      <span translate="no" className="inline-flex items-baseline gap-1.5">
        <span className="font-display text-heading-lg font-semibold tracking-tight">Ilm-ul-Quran</span>
        <span className="eyebrow text-primary">USA</span>
      </span>
    </Link>
  );
}
