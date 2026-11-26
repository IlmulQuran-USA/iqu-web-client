import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { InlineText as Inline } from "@/components/ui/InlineText";
import { hasDraftChanges, type LegalBlock, type LegalChange, type LegalDoc } from "@/content/legal";
import { PENDING } from "@/content/site";
import { cn } from "@/lib/cn";

/*
 * The one legal template (/legal/privacy, /terms, /refund, /accessibility).
 * A Server Component with no client code: H1, the live page's subtitle, the
 * "Last updated" date, an "On this page" list for long documents, and each
 * section anchored by id (scroll-padding in globals.css clears the sticky
 * header). Body text keeps to the prose measure. Print: the header, footer,
 * breadcrumb and contents list are left out, so a policy prints as a document.
 *
 * Proposed changes (status "draft", src/content/legal.ts) are marked on the
 * page as soft warning badges with the text on a tint, so the owner can review
 * them in place; they disappear once approved (the change is removed from the
 * content). Settled changes (status "live") are not marked.
 */

/** Long documents get a contents list. */
const TOC_MIN_SECTIONS = 5;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "10 Nov 2026" → "2026-11-10" for <time dateTime>, or null. */
function isoOf(date: string): string | null {
  const m = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/.exec(date);
  const month = m ? MONTHS.indexOf(m[2]) : -1;
  if (!m || month < 0) return null;
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** A proposed change, marked for review: a soft badge above the text, on the warning tint. */
function Proposed({ change, children }: { change: LegalChange | undefined; children: ReactNode }) {
  if (change?.status !== "draft") return <>{children}</>;
  const removal = change.kind === "remove";
  return (
    <div className="rounded-card bg-warning-tint px-4 py-3">
      <p className="text-ui font-medium text-warning">
        {removal ? "Proposed removal" : change.kind === "add" ? "Proposed addition" : "Proposed change"} · awaiting approval
      </p>
      <div className={cn("mt-1", removal && "text-ink-muted line-through")}>{children}</div>
    </div>
  );
}

/** Settled removals are kept in the content for the record, never shown. */
const shown = (change: LegalChange | undefined) => !(change?.status === "live" && change.kind === "remove");

function Block({ block }: { block: LegalBlock }) {
  if (block.type === "p") {
    if (!shown(block.change)) return null;
    return (
      <Proposed change={block.change}>
        <p className="text-pretty">
          <Inline text={block.text} />
        </p>
      </Proposed>
    );
  }
  if (block.type === "list") {
    return (
      <ul className="list-disc space-y-3 pl-5 marker:text-ink-muted">
        {block.items.filter((item) => shown(item.change)).map((item) => (
          <li key={item.text} className="pl-1 text-pretty">
            <Proposed change={item.change}>
              <Inline text={item.text} />
            </Proposed>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-1">
      {block.lines.map((line) => (
        <p key={line}>
          <Inline text={line} />
        </p>
      ))}
    </div>
  );
}

function ReviewNotice({ doc }: { doc: LegalDoc }) {
  const draftPage = doc.status === "draft";
  if (!draftPage && !hasDraftChanges(doc)) return null;
  return (
    <div className="mt-8 max-w-measure rounded-card bg-warning-tint p-4 text-ui">
      <p className="font-medium text-ink">{draftPage ? "Draft for review" : "Proposed changes for review"}</p>
      <p className="mt-1 text-pretty text-ink-body">
        {draftPage
          ? "This page has no current version. It is a draft and needs approval before the website goes live."
          : `The changes marked below update this policy for the new website and need approval before the website goes live. The current policy was last updated ${doc.source?.updated ?? PENDING}.`}
      </p>
    </div>
  );
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  const iso = isoOf(doc.updated);
  const toc = doc.sections.length >= TOC_MIN_SECTIONS;
  return (
    <>
      {/* display: contents keeps the header sticky; print leaves it out. */}
      <div className="contents print:hidden">
        <Header />
      </div>
      <main id="main-content" className="flex-1">
        <div className="container-content pt-2 pb-16 md:pb-24">
          <div className="print:hidden">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: doc.title }]} />
          </div>
          <div className="max-w-measure">
            <h1 className="mt-4 text-display-md font-medium text-balance md:text-display-lg">{doc.title}</h1>
            <p className="mt-4 text-body-lg text-pretty text-ink-body">{doc.lead}</p>
            <p className="mt-4 text-ui text-ink-muted">
              Last updated {iso ? <time dateTime={iso}>{doc.updated}</time> : doc.updated}
            </p>
          </div>
          <ReviewNotice doc={doc} />

          <div className="mt-10 lg:grid lg:grid-cols-12 lg:gap-6">
            {toc ? (
              <nav
                aria-labelledby="legal-contents"
                className="mb-10 border-t border-ink pt-4 print:hidden lg:sticky lg:top-[calc(var(--header-height)+2rem)] lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:mb-0 lg:self-start"
              >
                <h2 id="legal-contents" className="font-sans text-ui font-medium text-ink-muted">
                  On this page
                </h2>
                <ol className="mt-2">
                  {doc.sections.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="flex min-h-11 items-center rounded-chip py-1 text-ui text-ink-body decoration-1 underline-offset-2 hov:text-ink hov:underline"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null}

            <article className="max-w-measure space-y-5 text-body text-ink-body lg:col-span-8 lg:col-start-1 lg:row-start-1">
              {doc.intro.map((block, i) => (
                <Block key={i} block={block} />
              ))}
              {doc.sections.map((s) => (
                <section key={s.id} aria-labelledby={s.id} className="space-y-4 border-t border-rule pt-8 first:border-t-0 first:pt-0">
                  <h2 id={s.id} className="text-heading-lg text-balance text-ink md:text-heading-xl">
                    {s.title}
                  </h2>
                  {s.blocks.map((block, i) => (
                    <Block key={i} block={block} />
                  ))}
                </section>
              ))}
            </article>
          </div>
        </div>
      </main>
      <div className="contents print:hidden">
        <Footer />
      </div>
    </>
  );
}
