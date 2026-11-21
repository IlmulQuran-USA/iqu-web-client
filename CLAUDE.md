# CLAUDE.md — iqu-web-client

Next.js rebuild of ilmulquranus.org: public site, staged enrolment funnel, authenticated portal with Zoom-measured attendance.
Ilm-Ul-Quran USA · AL HASANAH FOUNDATION · 501(c)(3) · EIN 93-3902300.

---

## 1. Source of truth (highest first)

1. `PRODUCT.md` — the owner's product decisions (19 Nov 2026). Where they conflict with the spec, they win.
2. `docs/spec/PLUGIN-INVENTORY.md` — how IQU works today: pricing, billing, Zakat ledger, statuses, admin capabilities, data. Wins on business rules and data. Rebuild the behaviour; never port its PHP.
3. `docs/spec/README.md` — the UI specification: pages, content, states, visual intent. `docs/spec/` is a git submodule of `IlmulQuran-USA/iqu-web-platform`: read it, never edit it from this repo.
4. `DESIGN.md` — tokens and visual rules (derived from spec §5). **Exception:** its §2 colour tokens (Slate + Coral) supersede spec §5.1 by owner decision, 19 Nov 2026. For colour, DESIGN.md wins over the spec.
5. Wireframes — https://iqu-wireframes.netlify.app/ — a **draft**, not a layout to copy. Use it to see which screens exist and what each must contain. Layout, flow and interaction may be better than the wireframe, as long as no content, state or rule required by 1–4 is lost. Section anchors: `#home #catalog #course #instructor #about #trust #donate #programs #content #contact #enroll #auth #engine #student #parent #teacher #admin`.
6. Skill output (Impeccable, web-design-guidelines) — advisory only.

If a skill or detector suggestion contradicts 1–4, keep that choice and record the exception (see §5). Never import a third-party brand DESIGN.md (Stripe, Linear, etc.). Do not let `/impeccable document` overwrite `DESIGN.md` without review.

---

## 2. Before any UI work

- Read `DESIGN.md`, the spec section for the screen (§7.x / §7B / §7C / §7D), the matching wireframe section, and — for anything touching enrolment, fees, billing, coupons, Zakat, donations or admin — the matching part of `docs/spec/PLUGIN-INVENTORY.md`.
- Use the component names from spec §6.3. Check `src/components` before creating a new one.
- Build mobile-first at 375, then 1440.

---

## 3. Workflow per screen

1. **Plan** — `/impeccable shape <screen>`: section order from the spec, list every state.
2. **Build** — tokens only from CSS variables; no hard-coded hex, px font sizes or shadows outside the token set.
3. **Review** — `/impeccable critique <screen>`, then run the `web-design-guidelines` skill on the changed files.
4. **Browser QA (Playwright MCP)** — open `http://localhost:3000/<route>` at 375 and 1440. Take screenshots, check that every piece of content and every state the spec and inventory require is present (the wireframe is a content checklist, not a pixel target), click every CTA, tab through for focus order, check that nothing overflows its card or overlaps text. Fix before continuing.
5. **Detector** — `npx impeccable detect http://localhost:3000/<route>`.
6. **Finish** — `/impeccable polish <screen>`; for forms and the donation widget also `/impeccable harden <screen>`.

**Done** = all states built (default / hover / focus-visible / active / disabled / loading / error / empty), no P0/P1 findings, screenshots at 375 and 1440 checked.

---

## 4. Non-negotiables (from the spec)

**Accessibility & UX**
- 44 × 44 px minimum hit target on every interactive element, all viewports.
- Never disable zoom (`user-scalable=no` and `maximum-scale=1` forbidden).
- Visible focus ring, 2 px `--focus`, 2 px offset (`--accent` on `--band`) — never removed.
- Persistent visible labels; validate on blur, never on keystroke; error summary with anchors; `aria-live`.
- Modals trap and restore focus; Escape closes.
- Async buttons: spinner replaces label, width stays fixed, no double submit.
- One primary (filled) button per view. On public pages Donate is an outlined button with a short animated border (it stops after 3 laps and is static under reduced motion). Log in is a tonal button. Enrolment keeps the only filled button. Allowed exception: the newsletter Subscribe in the footer is a filled coral button, because it sits inside its own white card (owner decision, 20 Nov 2026).
- Coral `--accent` is never text or an icon on a light surface (2.9:1): use `--link` for text and `--accent-strong` for large text and icons. Status colours are always soft badges (tint + strong text), never solid fills. No green except the success status. No gradients — the one exception is the Donate button's animated border and its glow (owner decision, 19 Nov 2026).

**Content & trust**
- The name is always written Ilm-Ul-Quran USA (capital U).
- Always write Quran (no apostrophe), and Quranic. The organisation name stays Ilm-Ul-Quran USA. (Owner decision, 21 Nov 2026.)
- Najiba Mahzabin Jeba, Maha Rashed (owner, 21 Nov 2026) and Alauddin Khilzi (owner, 22 Nov 2026) are written with no title. Every other teacher keeps their title.
- No stock photos. Missing portrait → arch-framed monogram.
- Never invent fees, testimonials, ratings, credentials or statistics. Use `$XX` and `[pending]` placeholders until spec §8 content arrives.
- No fabricated review counts — honest empty state instead.
- Testimonials and sample content are shown for admin review; replace or confirm them before the public launch (owner, 21 Nov 2026). Mark them `status: "sample"`; `npm run content:check` lists them as a warning.
- Quran/Hadith: own block, `dir="rtl"`, line-height 2.0, full citation, never over a photo.
- Every displayed time carries its zone label. Dates as `30 Aug 2026`.
- Scholarship families see a scholarship status card, never a $0 invoice table.
- No countdowns or scarcity (only exception: real Summer Camp registration deadline). No carousels for primary content, no parallax, no scroll-hijack.
- Course detail: all sections in the DOM with anchored sub-nav — no click-tabs.

**Attendance engine (§7C)**
- Only the six statuses: Present, Partial, Technical issue, Student absent, Teacher no-show, Class not held.
- Thresholds read from settings, never hard-coded.
- System facts render as `ReadOnlyFact`, never as a disabled input.
- Never build: Join/Not Join buttons, start/end time inputs, teacher Present/Absent selection, "Mark class as completed", recordings.

**Performance**
- LCP < 2.0 s (mobile 4G) · CLS < 0.05 · INP < 150 ms · marketing-route JS < 180 KB gz.
- Every image/media element has explicit width and height. Hero: `priority` + blur placeholder.
- Fonts via `next/font`, self-hosted, `display: swap`, subset.

---

## 5. Spec-mandated exceptions to skill/detector rules

Riwāq deliberately uses some patterns generic detectors flag (uppercase eyebrow labels with 0.08em tracking, middle-dot trust strips, hairline rules, a high-contrast serif). When a detector flags one of these on a spec-mandated element, do not change the design. Add a scoped ignore with a reason that cites the spec section, and list it here:

| Rule id | Scope | Reason (spec §) |
| ------- | ----- | --------------- |
| `hero-eyebrow-chip` | Home hero eyebrow (`src/components/home/HomeHero.tsx`; ignore in `.impeccable/config.json`) | Spec §7.1. `detect <url>` no longer lists it at 375 or 1440 (checked 20 Nov 2026); the ignore stays as a safeguard. |
| `first-viewport-column-overflow` | Course detail grid (`src/app/courses/[slug]/page.tsx`; ignore in `.impeccable/config.json`) | Spec §7.3 section 11: the desktop right-rail enrolment card. It is sticky, so the short column stays beside the reader all the way down (owner plan, 20 Nov 2026). Kept as a safeguard: since the card moved after the hero in the DOM (it spans both grid rows), `detect <url>` no longer reports it. |

---

## 6. Open decisions (do not resolve silently)

- **Font budget:** §5.2 lists Newsreader, IBM Plex Sans, IBM Plex Mono and an Arabic face; §9.3 caps marketing routes at 2 families / 4 weights. Until decided: marketing routes load only Newsreader + IBM Plex Sans; Plex Mono loads only on portal/billing routes; the Arabic face loads only where a Quran/Hadith block renders.
- **Arabic face:** Kitab vs Amiri Quran — confirm licence/source before shipping Kitab.

---

## 7. Code conventions

- Next.js App Router, TypeScript, Tailwind. Design tokens are CSS variables in `src/app/globals.css`, mapped into the Tailwind theme.
- Icons: Lucide only.
- Filter state lives in the URL query string (catalog, instructors).
- Data layer reads existing `iqu_registrations`, `iqu_zeffy_payments`, `iqu_coupons` shapes — do not invent a second record of giving.
