import { allowed, CONSENT_EVENT, CONSENT_MAX_AGE, COOKIES, hasChosen, parseCookies, TAGS, type Category } from "@/lib/consent";

/*
 * Runs the cookie choices (rules: src/lib/consent.ts; markup: ./ConsentBanner).
 * Loaded right after hydration by ./useConsentLoader, as its own chunk.
 *
 * Nothing loads that the visitor (or the region's opt-out default) did not
 * allow: GA4 only with statistics, the Meta Pixel only with marketing. Each
 * time the tags are set up or changed, window gets a CONSENT_EVENT, so the
 * confirmation page can send its Meta Lead once the Pixel is there.
 * Tags run on the public site only (NEXT_PUBLIC_SITE_ENV=production), or on
 * a staging build with NEXT_PUBLIC_CONSENT_TAGS=on, so dev never writes
 * into the live GA4 property or Pixel. The banner works everywhere.
 *
 * No library and no React: about 2 KB gzipped (counted by js-budget).
 */

type Fn = ((...args: unknown[]) => void) & Record<string, unknown>;
type W = Window & { dataLayer?: unknown[]; gtag?: Fn; fbq?: Fn; _fbq?: Fn };

const TAGS_ON = process.env.NEXT_PUBLIC_SITE_ENV === "production" || process.env.NEXT_PUBLIC_CONSENT_TAGS === "on";
const CATEGORIES: Category[] = ["statistics", "marketing"];

function jar() {
  const cookies = parseCookies(document.cookie);
  return (name: string) => cookies.get(name);
}

/** What runs now, per category; a Global Privacy Control signal declines the region's opt-out default. */
function current(): Record<Category, boolean> {
  const get = jar();
  const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  return { statistics: allowed(get, "statistics", gpc), marketing: allowed(get, "marketing", gpc) };
}

function inject(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function adSignals(granted: boolean) {
  const v = granted ? "granted" : "denied";
  return { ad_storage: v, ad_user_data: v, ad_personalization: v };
}

/** GA4 with Consent Mode v2: analytics follows statistics; the ad signals follow marketing. */
function startGa(marketing: boolean) {
  const w = window as W;
  if (w.gtag) return;
  w.dataLayer = w.dataLayer || [];
  // gtag must push the arguments object itself.
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  } as Fn;
  w.gtag("consent", "default", {
    analytics_storage: "granted",
    ...adSignals(marketing),
  });
  w.gtag("js", new Date());
  w.gtag("config", TAGS.ga4);
  inject(`https://www.googletagmanager.com/gtag/js?id=${TAGS.ga4}`);
}

/** The Meta Pixel base code (as Meta publishes it), then PageView. */
function startPixel() {
  const w = window as W;
  if (w.fbq) return;
  const n = function fbq(...args: unknown[]) {
    if (n.callMethod) (n.callMethod as Fn).apply(n, args);
    else (n.queue as unknown[]).push(args);
  } as Fn;
  Object.assign(n, { push: n, loaded: true, version: "2.0", queue: [] });
  w.fbq = n;
  w._fbq = w._fbq || n;
  inject("https://connect.facebook.net/en_US/fbevents.js");
  n("init", TAGS.metaPixel);
  n("track", "PageView");
}

/** Drops a tool's cookies when its category is turned off: host-only, and on the site's domain, where GA4 and Meta set them. */
function dropCookies(pattern: RegExp) {
  const site = location.hostname.split(".").slice(-2).join(".");
  for (const name of document.cookie.split(";").map((c) => c.split("=")[0].trim())) {
    if (!pattern.test(name)) continue;
    for (const d of ["", `; Domain=.${site}`]) document.cookie = `${name}=; Max-Age=0; Path=/${d}`;
  }
}

/** Starts or stops each tool to match the current choices. */
function apply(now: Record<Category, boolean>) {
  if (!TAGS_ON) return;
  const w = window as W;
  if (w.gtag) {
    w.gtag("consent", "update", {
      analytics_storage: now.statistics ? "granted" : "denied",
      ...adSignals(now.marketing),
    });
    if (!now.statistics) dropCookies(/^_ga/);
  } else if (now.statistics) startGa(now.marketing);
  if (now.marketing) {
    if (w.fbq) w.fbq("consent", "grant");
    else startPixel();
  } else if (w.fbq) {
    w.fbq("consent", "revoke");
    dropCookies(/^_fb[pc]$/);
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

function save(choice: Record<Category, boolean>) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  for (const c of CATEGORIES) {
    document.cookie = `${COOKIES[c]}=${choice[c] ? "granted" : "denied"}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  }
  apply(choice);
}

let started = false;

/**
 * Starts the tags the stored choice (or the region's default) allows, and
 * wires the banner and the dialog (they live in the root layout, so they are
 * wired once per page load). Client-side navigations need no code: the Meta
 * Pixel sends a PageView on each history change by itself (fbevents.js
 * pushState tracking), and GA4's enhanced measurement counts "page changes
 * based on browser history events".
 */
export function startConsent() {
  if (started) return;
  started = true;
  apply(current());

  const banner = document.getElementById("consent-banner");
  const dialog = document.getElementById("consent-dialog") as HTMLDialogElement | null;
  const status = document.getElementById("consent-status");
  if (!banner || !dialog) return;
  // The banner and the dialog.
  {
    const root = document.documentElement;

    // The sticky enroll bars sit above the banner on phones (globals.css --consent-offset).
    const observer = new ResizeObserver(() => {
      // clientWidth, not innerWidth: the page's width without a scrollbar, which the full-width banner spans.
      const fullWidth = banner.offsetWidth >= root.clientWidth - 1;
      root.style.setProperty("--consent-offset", !banner.hidden && fullWidth ? `${banner.offsetHeight}px` : "0px");
    });
    observer.observe(banner);

    const showBanner = (show: boolean) => {
      // Which message shows (globals.css): analytics already on, or nothing on before a choice.
      if (show && current().statistics) banner.dataset.model = "opt-out";
      banner.hidden = !show;
      if (!show) root.style.setProperty("--consent-offset", "0px");
    };

    // The dialog's own code loads on first open (./consent-dialog), outside the first load.
    const openDialog = (from: HTMLElement) => void import("./consent-dialog").then((m) => m.openConsentDialog(dialog, from, current(), decide));

    const decide = (choice: Record<Category, boolean>) => {
      save(choice);
      if (dialog.open) dialog.close();
      showBanner(false);
      if (status) status.textContent = status.dataset.saved ?? "";
    };

    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>("[data-consent-action], [data-consent-open]");
      if (!target) return;
      if (target.hasAttribute("data-consent-open")) {
        event.preventDefault();
        openDialog(target);
        return;
      }
      // Accept and Decline, in the banner and in the dialog. Save and Close belong to the dialog's own code.
      const action = target.dataset.consentAction;
      if (action === "accept") decide({ statistics: true, marketing: true });
      else if (action === "decline") decide({ statistics: false, marketing: false });
      else if (action === "settings") openDialog(target);
    };

    document.addEventListener("click", onClick);
    showBanner(!hasChosen(jar()));
  }
}
