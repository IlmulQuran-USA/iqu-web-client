"use client";

import { useEffect } from "react";

/**
 * Loads the cookie banner's script (./consent-runtime) right after
 * hydration, as its own chunk. Called by the site Header (every public page
 * and the 404) and the enroll screens, which have no site Header.
 *
 * Why its own chunk (js-budget, 27 Nov 2026): the shared page chunks are on a
 * knife edge. Any client code added to every page (here, first, next/link and
 * a Lucide icon in the root layout's banner markup) made Turbopack regroup
 * them and copy Button, Logo, Lucide and next/image into a second chunk on
 * /enroll (+7 KB, over the 180 KB budget). Loading the runtime with import()
 * leaves those chunks exactly as they were. It is still counted:
 * scripts/js-budget.mjs adds it to every route. The enroll screens call
 * import() inline rather than this hook, so they share no new module with
 * the Header. Keep the banner markup (ConsentBanner) free of client components.
 */
export function useConsentLoader() {
  useEffect(() => {
    void import("./consent-runtime").then((m) => m.startConsent());
  }, []);
}
