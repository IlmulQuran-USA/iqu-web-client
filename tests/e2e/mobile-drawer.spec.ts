import { expect, test, type Page } from "@playwright/test";

/*
 * Regression (20 Nov 2026): on the owner's phone (http://192.168.0.94:3000)
 * the dev server blocked dev resources for that origin, the page never
 * hydrated and the mobile drawer could not open. Fixed with
 * allowedDevOrigins in next.config.ts. This test opens the drawer by touch
 * at 375 px on Home and on a course page, then closes it with the Close
 * button and with Escape.
 *
 * Focus on open: the drawer deliberately focuses Close, not its first link,
 * so a stray Enter can't navigate away (src/components/layout/MobileNav.tsx).
 * The test asserts that, and that the first link is visible.
 */

const ROUTES = ["/", "/courses/quran-hifz"];

/** Taps the menu button until the drawer opens; before hydration a tap does nothing. */
async function openDrawer(page: Page) {
  const trigger = page.getByRole("button", { name: "Open menu" });
  const drawer = page.getByRole("dialog", { name: "Menu" });
  await expect(async () => {
    await trigger.tap();
    await expect(drawer).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 45_000 });
  return { trigger, drawer };
}

for (const route of ROUTES) {
  test(`mobile drawer opens and closes on ${route}`, async ({ page }) => {
    await page.goto(route);

    // Open by touch.
    const { trigger, drawer } = await openDrawer(page);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    // The first link is visible; focus starts on Close (deliberate, see above).
    const firstLink = drawer.getByRole("link").first();
    await expect(firstLink).toBeVisible();
    const close = drawer.getByRole("button", { name: "Close menu" });
    await expect(close).toBeFocused();

    // Close with the Close button: focus returns to the menu button.
    await close.tap();
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Close with Escape.
    await openDrawer(page);
    await expect(firstLink).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}
