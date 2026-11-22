# DESIGN.md — Ilm-Ul-Quran USA · "Riwāq"

> Derived from `docs/spec/README.md` §4.1, §5, §6.4, §9. If this file and the spec ever disagree, the spec wins — fix this file, not the spec. **One exception:** the colour tokens in §2 (Slate + Coral) supersede spec §5.1 by owner decision, 19 Nov 2026.
> Format follows the awesome-design-md structure. This is IQU's own system; no third-party brand file is used.

---

## 1. Visual theme

**Direction C "Riwāq" — premium editorial institution.** A seminary that has existed for a century, not a startup. Authority, scholar credibility, donor confidence.

- **From C:** type scale, 12-column grid, hairline rules. Sections separated by whitespace and rules.
- **Palette:** Slate + Coral (§2), which replaces Direction C's forest green and sienna. Slate carries text and actions; coral is the brand accent. Green appears only in the success status.
- **From A ("Sakīna"):** component density, radius, form design. Forms, buttons, labels and table headers are never set in the display serif.
- **From B ("Nūr") — exactly one element:** the eight-point *khatam* girih lattice, 1 px line. Used in two places only: behind the donation hero, and as the portal empty-state graphic. (Home §7.1 nonprofit band also carries it at 4% opacity, per spec.)
- **Signature element:** the **riwāq arch** — one geometric construction, reused at three scales: hero image frame, instructor portrait frame (including monogram fallback), auth-page photo.
- **Risk to manage:** C can feel cold to a parent of a six-year-old. Counterbalance with warm, real photography (never stock) and the coral accent.

Coloured bands are not used for section separation. The only exceptions:
- Home nonprofit band: `--surface-2`.
- Footer newsletter: no longer a band. It is a white card (`--paper`) at the top of the footer, inside its container: 12 px radius, 32 px padding (24 px on phones), no edge, 48 px above the link columns. Light-surface rules inside it (`--ink`, `--ink-muted`, the `--focus` ring); the field border is `--field-border-subtle` (slate-500, 4.8:1); Subscribe is the coral `band` button (owner decisions, 19 and 20 Nov 2026).
- Footer and Home final CTA band: `--band` (dark slate).

---

## 2. Colors (colour tokens)

> **Slate + Coral palette — supersedes spec §5.1, owner decision 19 Nov 2026.** No green anywhere except the success status. No gradients (one exception: the Donate border animation, §8). Ratios are WCAG 2.x contrast against the background named.

**Neutrals (Tailwind slate)**

| Token         | Hex       | Use                                                        |
| ------------- | --------- | ---------------------------------------------------------- |
| `--ink`       | `#0F172A` | Headings, display text (17.9:1 on `--paper`)               |
| `--ink-body`  | `#334155` | Body text (10.4:1)                                         |
| `--ink-muted` | `#475569` | Captions, secondary text; safe on every light surface (≥ 5.6:1) |
| `--paper`     | `#FFFFFF` | Page background                                            |
| `--surface-2` | `#F8FAFC` | Alternate sections, nested surfaces, `ReadOnlyFact` ground |
| `--surface`   | `#F1F5F9` | Cards, wells, table stripes                                |
| `--rule`      | `#E2E8F0` | Hairlines, borders (decorative; never the only boundary of a control) |
| `--field-border-subtle` | `#64748B` | slate-500, 4.8:1 on `--paper`: the field border inside the footer newsletter card (owner decision, 20 Nov 2026) |

**Actions**

| Token             | Hex       | Use                                                    |
| ----------------- | --------- | ------------------------------------------------------ |
| `--primary`       | `#0F172A` | Filled primary button, white label (17.9:1)            |
| `--primary-hover` | `#1E293B` | Primary hover (white label 14.6:1)                     |
| Secondary         | `#334155` | 1 px `--ink-body` outline, `--ink-body` label, transparent fill |

**States.** Hover and press must be visible on their own, not only by a shade change:
- Primary: hover `--primary-hover`; pressed lifts to `--primary-active` = `--ink-body` (white label 10.4:1). Primary is already the darkest slate, so it cannot press darker.
- Secondary: hover is a 6% `--ink` overlay and press is 12%, so it shows on `--paper`, `--surface-2` and `--tint` alike.
- Nav, menu and drawer links: hover adds a 1 px `--accent-strong` underline. The current page has a 2 px `--accent-strong` underline (3.9:1).
- Links on `--band` stay white on hover and gain an underline. Only Donate is coral there.

**Coral (accent)**

| Token             | Hex       | Use                                                                 |
| ----------------- | --------- | ------------------------------------------------------------------- |
| `--accent`        | `#F96C48` | Brand coral: highlight marks, decorative shapes, illustrations, and any text or icon on `--band` (6.2:1). **Never** as text or an icon on a light surface (2.9:1). |
| `--accent-strong` | `#D45C3D` | Coral for large text (≥ 24 px) and icons on light surfaces (3.9:1)   |
| `--link`          | `#AE4C32` | Text links and the Donate text link (5.4:1)                          |
| `--tint`          | `#FEF0ED` | One soft coral section per page at most (see Rules); selected states |
| `--mark`          | `#FDD5CA` | Highlighter mark behind a key phrase in a headline (`--ink` on it 13.2:1) |

**Dark band**

| Token           | Hex       | Use                                                                 |
| --------------- | --------- | ------------------------------------------------------------------- |
| `--band`        | `#0F172A` | Footer and final CTA band. Text `#FFFFFF` (17.9:1); secondary `#CBD5E1` (12.0:1); accents `#F96C48` (6.2:1). |
| Primary on band | `#F96C48` | Fill `--accent`, label `--ink` (6.2:1)                             |

**Focus**

| Token     | Hex       | Use                                                      |
| --------- | --------- | -------------------------------------------------------- |
| `--focus` | `#0F172A` | 2 px ring, 2 px offset (17.9:1). On `--band`: `#F96C48` (6.2:1). |

**Status:** always a soft badge (tint background + strong text), never a solid fill.

| Status  | Tint      | Strong text | Ratio |
| ------- | --------- | ----------- | ----- |
| Success | `#ECFDF3` | `#067647`   | 5.4:1 |
| Warning | `#FFFAEB` | `#B54708`   | 5.2:1 |
| Danger  | `#FEF3F2` | `#B42318`   | 6.1:1 |
| Info    | `#EFF8FF` | `#175CD3`   | 5.6:1 |

Tokens: `--success` / `--success-tint`, `--warning` / `--warning-tint`, `--danger` / `--danger-tint`, `--info` / `--info-tint`. The strong colour is also used for inline field errors (`--danger` on `--paper`, 6.6:1) and success messages (`--success` on `--paper`, 5.7:1).

**Danger button:** fill `--danger` `#B42318`, white label (6.6:1), always behind a confirm dialog.

**Rules**
- All text/background pairs ≥ 4.5:1 (WCAG AA). Large text (≥ 24 px, or ≥ 18.7 px bold) and UI boundaries ≥ 3:1.
- `--accent` is never text or an icon on a light surface; use `--accent-strong` (large or icons) or `--link` (text).
- **`--tint` fills at most one section per page** (owner decision, 19 Nov 2026). A section is a full-width page region or band. Selected and current states (nav current page) are not sections and do not count. The newsletter, which used that allowance on every page, now sits inside the footer on `--band`, so the allowance is currently unused. The arch monogram is never on `--tint` (§7).
- Form field boundaries use `--ink-muted` (7.6:1), not `--rule`.
- No gradients anywhere, with one exception (owner decision, 19 Nov 2026): the Donate button's travelling border light, a conic gradient, and its glow (§8).

---

## 3. Typography

| Role        | Face                              | Sizes (px)                               |
| ----------- | --------------------------------- | ---------------------------------------- |
| Display     | Newsreader 500/600                | 64 / 48 / 36                             |
| Heading     | Newsreader 600                    | 30 / 24 / 20                             |
| Body        | IBM Plex Sans 400                 | 18 / 16                                  |
| UI / label  | IBM Plex Sans 500                 | 14 / 13 (+ 15 / 12 for instructor card captions only: name ≥ 1024, role 640–1023; owner decision 19 Nov 2026) |
| Data / mono | IBM Plex Mono 400                 | 14 — invoices, IDs, transaction refs     |
| Arabic      | Kitab or Amiri Quran              | +2 px vs Latin at same rank              |

**Rules**
- Line height: 1.15 display, 1.6 body. Quranic text: 2.0.
- Body measure capped at 68 characters.
- Sentence case everywhere, except eyebrow labels: uppercase, 0.08em tracking.
- Arabic and Latin never share a line box. Quranic text sits in its own block with `dir="rtl"`.
- Never set a form label, button or table header in Newsreader.
- Loading: self-hosted with Next.js font loading, `font-display: swap`, subset. Performance budget is 2 families / 4 weights on marketing routes (see open decision in CLAUDE.md).

---

## 4. Spacing, grid, radius, elevation

- Base unit **4 px**. Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- Public grid: 12 columns, 1200 px max content width, 24 px gutter, 1440 px max container.
- Portal grid: 12 columns, fluid, 264 px fixed sidebar (collapses to 72 px icons).
- Section vertical rhythm: 96 px desktop / 64 px tablet / 48 px mobile.
- Radius: 4 px inputs & chips · 8 px buttons · 12 px cards · 999 px avatars & pills. Arch-framed portraits are the only exception.
- Elevation — two levels only:
  - Card: `0 1px 2px rgba(15,23,42,.06)`
  - Overlay: `0 8px 24px rgba(15,23,42,.12)`
  - Lift (owner, 22 Nov 2026): `--elevation-lift`, `0 10px 24px -6px rgba(15,23,42,.18), 0 2px 6px rgba(15,23,42,.06)`. Only under a button or card while it is hovered (§6); it fades in by opacity and is never a resting state.
  - Exception: `--glow-accent`, the soft coral glow that follows the Donate border light (§8). Not an elevation; used nowhere else.

---

## 5. Breakpoints (mobile-first)

| Name  | Min width | Notes                                |
| ----- | --------- | ------------------------------------ |
| `sm`  | 480       | Large phone                          |
| `md`  | 768       | Tablet                               |
| `lg`  | 1024      | Public nav expands; portal sidebar appears |
| `xl`  | 1280      | Desktop                              |
| `2xl` | 1536      | Max container caps here              |

Every screen is built and checked at **375** and **1440**; **768** where layout genuinely changes.

**Deliberate exception: public nav collapses below `lg`, not `md`.** Spec §5.4 collapses the public nav below 768. The desktop header row (wordmark, five nav items, Log in, Start free trial) needs about 960 px, so it cannot fit at 768 without truncating. Below 1024 the mobile drawer is used instead. The owner approved this on 19 Nov 2026.

---

## 6. Motion

> **Owner decision, 22 Nov 2026:** clearly visible motion across the site, built with Motion (`motion/react`). It replaces the earlier subtle CSS reveals (12 px, 60 ms) and lifts the earlier "never on reading text, no hero or counter motion" limits. Two rules remain: respect reduced motion, and move only transform and opacity.

- Durations: 120 ms micro · 200 ms default · 320 ms page/panel · 550 ms spring (CSS `--ease-spring`, a sampled damped spring).
- Easing: `cubic-bezier(0.2, 0, 0, 1)` for fades and exits; springs for everything that enters or moves (`src/components/motion/tokens.ts`: reveal spring 0.7 s / bounce 0.18; snappy spring 0.38 s / bounce 0.14).
- One boundary: `MotionProvider` in the root layout (LazyMotion strict, features loaded after hydration; `MotionConfig reducedMotion="user"`).
- Scroll reveal (`Reveal`, `RevealItem`): each section below the hero fades in and rises 30 px on a spring as it scrolls into view, once; its items (cards, rows, steps, questions, testimonials, instructor cards) follow 80 ms apart. Only sections that start below the fold are ever hidden; keyboard focus inside one reveals it at once; print shows everything.
- Hero (`Rise`): eyebrow and H1, subhead, buttons, trust line, then the portraits rise 24 px into place, 80 ms apart, at full opacity. CSS keyframes, not Motion, so it plays with the first paint rather than after hydration (about 3 s later on a throttled phone).
- Hover and press (CSS, works before hydration): buttons lift 2 px and cards 4 px with a soft shadow fading in (`.lift`, `.lift-card`), instructor cards lift without a shadow (`.lift-plain`); presses give to 97% (buttons) or 99% (cards); portraits zoom 7% inside the arch.
- Menus, the mobile drawer and its sections, and the FAQ open and close on springs. The FAQ answer and drawer sections animate height: the one exception to transform/opacity, so the content below moves smoothly instead of jumping.
- Filters on /courses and /instructors: cards glide to their new places (layout animation); leavers fade, arrivals rise in.
- Numbers below the hero (the Home teacher facts) count up from 0 as they scroll into view; each keeps its final width.
- `prefers-reduced-motion: reduce` → opacity only: no rise, lift, zoom, glide, count or slide.
- Forbidden: parallax, auto-playing carousels, scroll-hijacking.

---

## 7. Imagery & iconography

- Real photography only. No stock image of a generic child at a laptop. Missing photo → arch-framed initial monogram (spec §7.1: "monogram placeholders in `--surface` with the arch mask"): `--surface` fill, Newsreader initials in `--ink-body` (9.6:1), and a 1 px `--accent` hairline on the arch edge, which replaces the concentric hairline a photograph has. No `--tint` fill and no coral letters.
- Instructor portraits: 1:1 source, riwāq arch mask, warm neutral background.
- Quran/Hadith never used as decoration and never overlaid on a photo — typography only, with full citation.
- Illustration: line-only, `--ink` or `--accent`, 1.5 px. No filled cartoon styles.
- Images: AVIF/WebP, explicit width/height, lazy below the fold, `priority` only on the hero.
- Icons: **Lucide only**, 1.5 px stroke, 24 px grid. Always paired with a label, except dense portal toolbars (then `aria-label` + tooltip).

---

## 8. Buttons

| Variant   | Use                                | Style                                                         |
| --------- | ---------------------------------- | ------------------------------------------------------------- |
| Primary   | One per view. Enrol, Save.         | Filled `--primary`, white text, 8 px radius, 44 px min height |
| Secondary | Alternative action                 | 1 px `--ink-body` outline, `--ink-body` label, transparent fill |
| Ghost     | Tertiary, in-table actions         | `--ink` text only, underline on hover                         |
| Tonal     | Log in                             | `--surface` fill, `--ink` label, font-medium, no border, 8 px radius, 44 px; `--rule` on hover; Lucide `UserRound` before the label (icon-only from 1024 to 1279) |
| Donate    | Giving, on public pages            | Double border drawn inside the 44 px box, so Donate is exactly the size of the buttons beside it: the outer line is the 1 px `--accent-strong` border, the inner line an inset 1 px `--accent-strong` line 3 px in (2 px of the button's fill between them). On keyboard focus the outer border turns `--ink` (no outside ring; owner decision, 20 Nov 2026); under forced colours focus draws a Highlight ring inside the box. `--link` label, Lucide `HandHeart` (1.5 px, `--accent-strong`) before it, 8 px radius, 44 px. Never filled. A coral (`--accent`) light travels along the outer border with a `--glow-accent` glow: 3 laps on load (4.5 s), one on hover and focus (the heart beats once on hover), then a static border; nothing moves under reduced motion |
| Danger    | Destructive                        | Filled `--danger`, white label, always behind a confirm dialog |
| Link      | Inline in prose                    | `--link`, underlined, 2 px offset                             |
| On band   | Primary action on `--band`; the newsletter Subscribe in its white card | Filled `--accent`, `--ink` label (6.2:1)                    |

All buttons: 44 × 44 px minimum hit area · focus ring 2 px `--focus` (`--accent` on `--band`), 2 px offset · loading state replaces the label with a spinner and keeps the width fixed · no double submit.

On public pages **Donate** is an outlined button with a short animated border (it stops after 3 laps and is static under reduced motion). Log in is a tonal button. Enrolment keeps the only filled button; the one exception is the newsletter Subscribe, a filled coral button inside its own white card in the footer (owner decision, 20 Nov 2026). In footer link lists Donate stays a coral text row on `--band`.

---

## 9. Components (component-level rules)

- **States:** every component ships default / hover / focus-visible / active / disabled / loading / error / empty.
- **`ReadOnlyFact`:** `--surface-2` ground, no border, no focus ring, small system glyph. Must never look like a disabled input.
- **`AttendanceStatusBadge`:** exactly six statuses, each a soft badge (tint background + strong text, never a solid fill): Present (success), Partial (warning), Technical issue (info), Student absent (danger), Teacher no-show (danger), Class not held (`--surface` + `--ink-muted`). Thresholds come from settings, never hard-coded.
- **`OverlapBar`:** teacher track, student track, overlap band in `--ink`; scheduled window marked with hairlines. Mobile: tracks stack, axis compresses to start/end labels.
- **Empty states:** girih line illustration, one sentence, one action.
- **Forms:** persistent visible labels (no placeholder-as-label), validation on blur, errors adjacent to field, error summary at top with anchors, `aria-live`.

---

## 10. Do / Don't

**Do**
- Let one element per screen be memorable; keep the rest quiet.
- Show EIN 93-3902300 adjacent to every giving ask.
- Show the time-zone label with every time.

**Don't**
- Purple-to-blue (or any) gradient text or washes.
- Emoji icon tiles above headings.
- Countdown timers or scarcity copy (only exception: a real Summer Camp registration deadline).
- Fabricated ratings, review counts or testimonials.
- Sliders/carousels for primary content.
- Click-tabs that hide content from the DOM.
