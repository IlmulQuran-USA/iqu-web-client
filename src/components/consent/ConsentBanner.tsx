import { consentCopy } from "@/content/consent";

/*
 * Cookie banner and Cookie settings dialog (owner brief, 27 Nov 2026). Server
 * markup only, hidden until ./consent-runtime decides; the copy is never
 * part of the JavaScript. Without JavaScript nothing beyond the basics runs,
 * so the banner stays hidden and the footer link goes to the Privacy Policy.
 *
 * - Banner: a labelled region, not a modal: it never takes focus or blocks the
 *   page. Full width at the bottom on phones (the sticky enroll bars move up
 *   above it, --consent-offset); a card at the bottom left from sm, away from
 *   the right-rail enroll card. Accept all and Decline have equal weight; no
 *   filled button, so enrollment keeps the only one (CLAUDE.md §4).
 * - Dialog: a native modal <dialog> (focus trap, inert page, Escape closes),
 *   focus returns to the control that opened it.
 */

// The secondary button (src/components/ui/Button.tsx, md), as classes: Button is a client module and this is server markup.
const BTN =
  "lift relative box-border inline-flex h-11 min-h-11 min-w-11 items-center justify-center gap-2 whitespace-nowrap rounded-button border border-ink-body px-5 font-sans text-body font-medium text-ink-body hov:bg-ink/6 act:bg-ink/12";
const LINK = "inline-flex min-h-11 cursor-pointer items-center rounded-chip text-ui text-link underline decoration-1 underline-offset-2 hov:decoration-2";
const ids = { banner: "consent-banner", title: "consent-banner-title", dialog: "consent-dialog", dialogTitle: "consent-dialog-title", status: "consent-status" };

export function ConsentBanner() {
  const { banner, dialog, categories } = consentCopy;
  return (
    <>
      <section
        id={ids.banner}
        aria-labelledby={ids.title}
        hidden
        className="consent-banner group fixed inset-x-0 bottom-0 z-45 border-t border-rule bg-paper px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-overlay sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[26rem] sm:rounded-card sm:border sm:p-5"
      >
        <h2 id={ids.title} className="font-display text-heading-md font-semibold text-ink">
          {banner.title}
        </h2>
        {/* One message shows: data-model="opt-out" (set by the runtime) when analytics already runs before a choice. */}
        <p className="mt-1 text-ui text-pretty text-ink-body group-data-[model=opt-out]:hidden">{banner.messageOptIn}</p>
        <p className="mt-1 hidden text-ui text-pretty text-ink-body group-data-[model=opt-out]:block">{banner.messageOptOut}</p>
        <div className="flex flex-wrap items-center gap-x-5">
          <button type="button" data-consent-action="settings" aria-haspopup="dialog" aria-controls={ids.dialog} className={LINK}>
            {banner.settings}
          </button>
          {/* A plain <a>, not next/link: a client component in the root layout regroups every page's chunks (js-budget). */}
          <a href={banner.policy.href} className={LINK}>
            {banner.policy.label}
          </a>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <button type="button" data-consent-action="accept" className={BTN}>
            {banner.accept}
          </button>
          <button type="button" data-consent-action="decline" className={BTN}>
            {banner.decline}
          </button>
        </div>
      </section>

      <dialog
        id={ids.dialog}
        aria-labelledby={ids.dialogTitle}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100%-2rem))] overflow-y-auto overscroll-contain rounded-card bg-paper p-0 text-ink shadow-overlay backdrop:bg-(--scrim)"
      >
        <form method="dialog" data-consent-form="" className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={ids.dialogTitle} className="pt-2 font-display text-heading-lg font-semibold">
              {dialog.title}
            </h2>
            <button
              type="button"
              data-consent-action="close"
              className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-button text-ink transition-colors duration-(--duration-micro) ease-riwaq hov:bg-surface-2"
            >
              {/* Lucide "x", inlined: lucide-react's icons are client modules, and none may enter the root layout. */}
              <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="size-6">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
              <span className="sr-only">{dialog.close}</span>
            </button>
          </div>
          <p className="mt-2 text-body text-pretty text-ink-body">{dialog.intro}</p>

          <ul className="mt-4 divide-y divide-rule border-y border-rule">
            {categories.map((c) => (
              <li key={c.id} className="py-4">
                {c.id === "functional" ? (
                  <div className="flex min-h-11 items-center justify-between gap-4">
                    <h3 className="font-sans text-body-lg font-medium text-ink">{c.title}</h3>
                    {/* Always on: stated as a fact, never a disabled checkbox. */}
                    <span className="text-ui text-ink-muted">{"always" in c ? c.always : null}</span>
                  </div>
                ) : (
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
                    <span className="text-body-lg font-medium text-ink">{c.title}</span>
                    <input
                      type="checkbox"
                      name={c.id}
                      aria-describedby={`consent-${c.id}-text`}
                      className="size-5 shrink-0 cursor-pointer accent-(--primary)"
                    />
                  </label>
                )}
                <p id={`consent-${c.id}-text`} className="mt-1 text-ui text-pretty text-ink-body">
                  {c.text}
                  {"tools" in c ? <span className="mt-1 block text-ink-muted">{c.tools}.</span> : null}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button type="button" data-consent-action="save" className={`${BTN} sm:flex-1`}>
              {dialog.save}
            </button>
            <button type="button" data-consent-action="accept" className={`${BTN} sm:flex-1`}>
              {dialog.accept}
            </button>
            <button type="button" data-consent-action="decline" className={`${BTN} sm:flex-1`}>
              {dialog.decline}
            </button>
          </div>
        </form>
      </dialog>

      {/* The controller writes data-saved here after a choice (the copy stays out of the JavaScript). */}
      <p id={ids.status} role="status" aria-live="polite" data-saved={dialog.saved} className="sr-only" />
    </>
  );
}
