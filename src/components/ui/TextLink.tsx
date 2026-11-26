import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * An inline text link with an arrow (44 px target). Its own module, with no
 * client imports, so a page that needs only this link (/donate) does not load
 * Motion through PriceList's RevealItem (js-budget, 26 Nov 2026). PriceList
 * re-exports it for the pages that already import it from there.
 */
export function TextLink({ label, href, className }: { label: string; href: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-chip text-body font-medium text-link underline decoration-1 underline-offset-2 hov:decoration-2",
        className,
      )}
    >
      {label}
      <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
    </Link>
  );
}
