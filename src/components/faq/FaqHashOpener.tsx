"use client";

import { useEffect } from "react";

/**
 * Opens the answer a link targets (/faq#<id>), on load and on every hash
 * change. Chrome, Edge and Firefox already open a closed <details> when its
 * content is targeted; Safari does not, so there the answer would stay shut.
 * When this script opens it, the question is scrolled into view (the page's
 * scroll-padding-top keeps it clear of the sticky header).
 */
export function FaqHashOpener() {
  useEffect(() => {
    const open = () => {
      let id = "";
      try {
        id = decodeURIComponent(location.hash.slice(1));
      } catch {
        return; // a malformed hash names no question
      }
      const target = id ? document.getElementById(id) : null;
      const details = target?.closest("details");
      if (!target || !details || details.open) return;
      details.open = true;
      // The question, not the anchor: the answer is still opening (and not laid out) at this point.
      details.querySelector("summary")?.scrollIntoView({ block: "start" });
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
