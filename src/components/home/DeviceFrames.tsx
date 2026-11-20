import Image from "next/image";
import { cn } from "@/lib/cn";

/*
 * Generic device frames for product screenshots (owner, 21 Nov 2026): drawn
 * in CSS, so they stay sharp at any size; no brand logos, no notch or
 * island, no product names. Colours and elevation come from the token set;
 * no gradients (DESIGN.md §2).
 *
 *   Laptop  a thin dark slate bezel around a 16:10 screen (12 px outer
 *           radius), a slim hinge, and a wide thin base with a small centred
 *           lid notch, with a soft shadow underneath.
 *   Phone   a thin uniform dark bezel (40 px outer radius at full size,
 *           scaling down with the frame), a status strip with a small round
 *           front-camera dot centred at the top, a slim bottom strip, and
 *           subtle side buttons. The screenshot sits between the strips,
 *           uncropped, so the rounded corners never clip its UI.
 *
 * Screenshots fill the screen exactly: object-fit cover, top aligned.
 */

type Shot = { src: string; alt: string; sizes: string };

export function LaptopFrame({ shot, className }: { shot: Shot; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {/* Lid: slightly narrower than the base, as on a real laptop. */}
      <div className="mx-auto w-[90%] rounded-[12px] bg-ink-body p-[1.2%] ring-1 ring-ink/40">
        <div className="relative aspect-[16/10] overflow-hidden rounded-chip bg-paper">
          <Image
            src={shot.src}
            alt={shot.alt}
            fill
            quality={90}
            sizes={shot.sizes}
            loading="lazy"
            className="object-cover object-top"
          />
        </div>
      </div>
      {/* Hinge. */}
      <div aria-hidden="true" className="mx-auto h-[3px] w-[86%] rounded-b-chip bg-ink" />
      {/* Base: wide and thin, with the lid notch; the soft shadow sits under it. */}
      <div aria-hidden="true" className="relative h-[clamp(8px,1.6vw,14px)] rounded-b-[12px] rounded-t-chip bg-on-band-muted shadow-overlay">
        <span className="absolute top-0 left-1/2 h-[45%] w-[14%] -translate-x-1/2 rounded-b-button bg-ink-muted/35" />
      </div>
    </div>
  );
}

export function PhoneFrame({ shot, className }: { shot: Shot; className?: string }) {
  return (
    // The container for the cqi units below (they resolve against an ancestor, never the element itself).
    <div className={cn("@container relative", className)}>
      {/* Side buttons, just outside the frame: volume on the left, power on the right. */}
      <span aria-hidden="true" className="absolute top-[18%] -left-[3px] h-[7%] w-[3px] rounded-l-chip bg-ink-body" />
      <span aria-hidden="true" className="absolute top-[27%] -left-[3px] h-[7%] w-[3px] rounded-l-chip bg-ink-body" />
      <span aria-hidden="true" className="absolute top-[22%] -right-[3px] h-[11%] w-[3px] rounded-r-chip bg-ink-body" />
      {/* The radius is 40 px at full size and scales down with the frame (container units), so a
          small phone is never over-rounded and its corners never clip the screenshot. */}
      <div className="rounded-[min(40px,15cqi)] bg-ink p-[3.2%] shadow-overlay ring-1 ring-ink-body/60">
        <div className="flex flex-col overflow-hidden rounded-[min(34px,12cqi)] bg-paper">
          {/* Status strip with the front camera, centred; the screenshot starts below it. */}
          <div aria-hidden="true" className="relative h-[9cqi] shrink-0">
            <span className="absolute top-1/2 left-1/2 aspect-square w-[4.5cqi] -translate-x-1/2 -translate-y-1/2 rounded-pill bg-ink ring-1 ring-ink-body" />
          </div>
          <div className="relative aspect-[1179/2556]">
            <Image
              src={shot.src}
              alt={shot.alt}
              fill
              quality={90}
              sizes={shot.sizes}
              loading="lazy"
              className="object-cover object-top"
            />
          </div>
          {/* Bottom strip: keeps the screenshot's tab bar clear of the rounded corners. */}
          <div aria-hidden="true" className="h-[6cqi] shrink-0" />
        </div>
      </div>
    </div>
  );
}
