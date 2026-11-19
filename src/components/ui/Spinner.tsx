import { cn } from "@/lib/cn";

/**
 * Decorative progress indicator. It inherits the text colour and is hidden
 * from assistive tech; the caller supplies the spoken status.
 * Reduced motion: no rotation, a slow opacity pulse instead (spec §5.5).
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={cn(
        "size-5 shrink-0 motion-safe:animate-spin motion-reduce:animate-pulse",
        className,
      )}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
