"use client";

import Image, { type StaticImageData } from "next/image";
import { useState, type CSSProperties } from "react";
import { archGeometry, archMask, archRatios, initialsOf, type ArchRatio } from "@/lib/arch";
import { cn } from "@/lib/cn";

/**
 * ArchFrame: the riwāq arch frame for portraits and hero photography
 * (spec §4, §5.6, DESIGN.md §1 and §7).
 *
 * The frame fills its container's width, so its scale comes from the layout
 * (instructor card, profile, hero), while the construction stays the same.
 *
 * States:
 *   image     the photograph, masked to the arch opening
 *   loading   the opening shows --surface until the image paints; its box is
 *             fixed by aspect-ratio, so nothing shifts
 *   missing   no photo yet (spec §8): an initial monogram on --surface.
 *             Stock imagery is never substituted.
 *   error     the image failed to load: falls back to the monogram
 */

type ImageSource =
  | { src: string | StaticImageData; width: number; height: number }
  | { src?: undefined; width?: undefined; height?: undefined };

export type ArchFrameProps = ImageSource & {
  /** The person or subject. Drives the monogram and the default alt text. */
  name: string;
  /** Alt text for the photograph. Defaults to the name, the same accessible name the monogram uses. */
  alt?: string;
  /** Set when the name is already printed next to the frame (cards). */
  decorative?: boolean;
  ratio?: ArchRatio;
  /** Responsive `sizes` for next/image. */
  sizes?: string;
  /** Hero image only (CLAUDE.md §4). */
  preload?: boolean;
  /** The concentric hairline. On by default. */
  hairline?: boolean;
  className?: string;
};

export function ArchFrame({
  name,
  src,
  width,
  height,
  alt,
  decorative = false,
  ratio = "portrait",
  sizes = "(min-width: 64rem) 25vw, 50vw",
  preload = false,
  hairline = true,
  className,
}: ArchFrameProps) {
  const [failed, setFailed] = useState(false);
  const r = archRatios[ratio];
  const geometry = archGeometry(r);
  const mask = archMask(r);
  const showImage = Boolean(src) && !failed;

  const maskStyle: CSSProperties = {
    maskImage: mask,
    WebkitMaskImage: mask,
    maskSize: "100% 100%",
    WebkitMaskSize: "100% 100%",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  };

  return (
    <div
      className={cn("@container relative w-full", className)}
      style={{ aspectRatio: geometry.aspectRatio }}
    >
      <div className="absolute inset-0 bg-surface" style={maskStyle}>
        {showImage && src ? (
          <Image
            src={src}
            width={width}
            height={height}
            alt={decorative ? "" : (alt ?? name)}
            sizes={sizes}
            preload={preload}
            onError={() => setFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <div
            role={decorative ? undefined : "img"}
            aria-label={decorative ? undefined : name}
            aria-hidden={decorative || undefined}
            className="flex size-full items-center justify-center pt-[18%]"
          >
            {/* Monogram size scales with the frame (container query units),
                so one rule serves every scale of the arch. */}
            <span className="font-display text-[30cqi] leading-none font-medium tracking-tight text-primary select-none">
              {initialsOf(name)}
            </span>
          </div>
        )}
      </div>

      {hairline ? (
        <svg
          aria-hidden="true"
          viewBox={geometry.viewBox}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
        >
          <path
            d={geometry.hairline}
            fill="none"
            stroke="var(--rule)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
    </div>
  );
}
