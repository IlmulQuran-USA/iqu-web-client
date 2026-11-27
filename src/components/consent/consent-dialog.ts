import type { Category } from "@/lib/consent";

/*
 * The Cookie settings dialog's own behaviour, loaded by ./consent-runtime the
 * first time someone opens it ("Choose cookies" in the banner, "Cookie
 * settings" in a footer), so it is not part of the first load.
 *
 * The dialog is a native modal: showModal() makes the rest of the page inert,
 * Tab cycles within the dialog's controls (they never reach the browser's own
 * controls either, unlike a bare modal), and Escape closes it. On
 * close, focus goes back to what opened it, or to <main> when that is gone
 * (the banner hides after a choice). Accept all and Decline all are handled
 * by the runtime, as in the banner; Save choices and Close are handled here.
 */

type Choices = Record<Category, boolean>;
const CATEGORIES: Category[] = ["statistics", "marketing"];

let wired = false;
let opener: HTMLElement | null = null;

export function openConsentDialog(dialog: HTMLDialogElement, from: HTMLElement, now: Choices, decide: (choice: Choices) => void) {
  const box = (c: Category) => dialog.querySelector<HTMLInputElement>(`input[name="${c}"]`);
  if (!wired) {
    wired = true;
    dialog.addEventListener("click", (event) => {
      const action = (event.target as Element | null)?.closest<HTMLElement>("[data-consent-action]")?.dataset.consentAction;
      if (action === "close") dialog.close();
      else if (action === "save") decide({ statistics: box("statistics")?.checked === true, marketing: box("marketing")?.checked === true });
    });
    // Tab and Shift+Tab cycle through the dialog's own controls, never out of it (the focus trap).
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const items = dialog.querySelectorAll<HTMLElement>("button, input");
      const first = items[0];
      const last = items[items.length - 1];
      const at = document.activeElement;
      if (event.shiftKey ? at === first || at === dialog : at === last) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    });
    dialog.addEventListener("close", () => {
      const main = document.getElementById("main-content");
      const back = opener?.isConnected && !opener.closest("[hidden]") ? opener : main;
      if (back === main) main?.setAttribute("tabindex", "-1");
      back?.focus({ preventScroll: true });
      opener = null;
    });
  }
  opener = from;
  for (const c of CATEGORIES) {
    const b = box(c);
    if (b) b.checked = now[c];
  }
  dialog.showModal();
}
