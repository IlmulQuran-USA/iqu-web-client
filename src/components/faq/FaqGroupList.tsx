import { ChevronDown } from "lucide-react";
import { InlineText } from "@/components/ui/InlineText";
import { TextLink } from "@/components/ui/TextLink";
import type { FaqEntry } from "@/content/faq";
import { cn } from "@/lib/cn";

/**
 * The /faq questions of one group: native <details>, so the disclosure works
 * with no JavaScript and keeps keyboard and screen-reader behaviour. The
 * answer opens with the same CSS spring as Home's (globals.css .faq-item), and
 * only fades under reduced motion. No motion library: unlike FAQList, nothing
 * here imports Motion.
 *
 * Deep links: /faq#<id>. The id sits on the first element INSIDE the answer,
 * so browsers that open a closed <details> when a link targets its content
 * (Chrome, Edge, Firefox) open the right question by themselves. The anchor's
 * scroll margin keeps the question in view under the sticky header.
 */
export function FaqGroupList({ items, className }: { items: readonly FaqEntry[]; className?: string }) {
  return (
    <div className={cn("border-t border-ink", className)}>
      {items.map((item) => (
        <details key={item.id} className="faq-item group border-b border-rule">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-chip py-4 text-body-lg font-medium text-ink [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown
              aria-hidden="true"
              strokeWidth={1.5}
              className="size-5 shrink-0 text-ink-muted transition-transform duration-(--duration-spring) ease-spring group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="flex max-w-measure flex-col gap-3 pb-6 text-body text-pretty text-ink-body">
            <span id={item.id} aria-hidden="true" className="block scroll-mt-20" />
            <p>
              <InlineText text={item.a} />
            </p>
            {item.points ? (
              <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-ink-muted">
                {item.points.map((point) => (
                  <li key={point} className="tabular-nums">
                    <InlineText text={point} />
                  </li>
                ))}
              </ul>
            ) : null}
            {item.after ? (
              <p>
                <InlineText text={item.after} />
              </p>
            ) : null}
            {item.link ? <TextLink label={item.link.label} href={item.link.href} className="self-start" /> : null}
          </div>
        </details>
      ))}
    </div>
  );
}
