import Link from "next/link";
import { Fragment } from "react";

const linkClass = "text-link underline decoration-1 underline-offset-2 hov:decoration-2";

/**
 * Content text with two inline marks: **bold** and [label](href). Internal
 * links use next/link; mailto:, tel: and https: links are plain anchors.
 * Used by the legal pages and /donate (src/content/legal.ts, donate.ts).
 */
export function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const bold = /^\*\*([^*]+)\*\*$/.exec(part);
        if (bold) return <strong key={i} className="font-medium text-ink">{bold[1]}</strong>;
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
        if (link) {
          const [, label, href] = link;
          return href.startsWith("/") ? (
            <Link key={i} href={href} className={linkClass}>
              {label}
            </Link>
          ) : (
            <a key={i} href={href} className={linkClass}>
              {label}
            </a>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
