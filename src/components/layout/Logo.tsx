import Image from "next/image";
import Link from "next/link";
import { site } from "@/content/site";
import { cn } from "@/lib/cn";

/**
 * The owner's logo artwork (owner decision, 19 Nov 2026: the logo replaces
 * the typographic wordmark site-wide). Its navy and orange are the brand's
 * own colours, not DESIGN.md tokens, and are left as drawn.
 *
 *   header  public/brand/logo-header.svg: design/brand-source/Logo.svg with
 *           only the tagline group removed and the viewBox tightened to the
 *           artwork's bounds (45.27 21.54 525.7 91.76): no redrawing, no
 *           recolouring, same proportions. Light surfaces: the header and the
 *           mobile drawer. Height 32 px below 768, 36 px to 1023, 40 px from
 *           1024 (owner decision, 19 Nov 2026); width follows (≈183/206/229).
 *   footer  public/brand/logo-footer.svg: the header artwork with only its
 *           two fills set to white (owner decision, 19 Nov 2026), for --band.
 *           40 px tall at every width, the header's desktop height.
 *
 * The link carries the accessible name; the image itself is decorative.
 */
export function Logo({
  variant = "header",
  className,
  onNavigate,
}: {
  variant?: "header" | "footer";
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href="/"
      aria-label={`${site.name} home`}
      onClick={onNavigate}
      className={cn("inline-flex min-h-11 shrink-0 items-center rounded-chip", className)}
    >
      {variant === "header" ? (
        <Image
          src="/brand/logo-header.svg"
          alt=""
          width={526}
          height={92}
          loading="eager"
          className="h-8 w-auto md:h-9 lg:h-10"
        />
      ) : (
        <Image src="/brand/logo-footer.svg" alt="" width={526} height={92} className="h-10 w-auto" />
      )}
    </Link>
  );
}
