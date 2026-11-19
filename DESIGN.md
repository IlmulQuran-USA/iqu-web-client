# DESIGN.md — Ilm-ul-Quran USA · "Riwāq"

> Derived from `docs/spec/README.md` §4.1, §5, §6.4, §9. If this file and the spec ever disagree, the spec wins — fix this file, not the spec.
> Format follows the awesome-design-md structure. This is IQU's own system; no third-party brand file is used.

---

## 1. Visual theme

**Direction C "Riwāq" — premium editorial institution.** A seminary that has existed for a century, not a startup. Authority, scholar credibility, donor confidence.

- **From C:** palette, type scale, 12-column grid, hairline rules. Sections separated by whitespace and rules.
- **From A ("Sakīna"):** component density, radius, form design. Forms, buttons, labels and table headers are never set in the display serif.
- **From B ("Nūr") — exactly one element:** the eight-point *khatam* girih lattice, 1 px line. Used in two places only: behind the donation hero, and as the portal empty-state graphic. (Home §7.1 nonprofit band also carries it at 4% opacity, per spec.)
- **Signature element:** the **riwāq arch** — one geometric construction, reused at three scales: hero image frame, instructor portrait frame (including monogram fallback), auth-page photo.
- **Risk to manage:** C can feel cold to a parent of a six-year-old. Counterbalance with warm, real photography — never stock.

Coloured bands are not used for section separation. Exceptions are only the bands the spec names: Home nonprofit band (`--surface`) and Home final CTA band (`--primary`).

---

## 2. Colors (colour tokens)

| Token             | Hex       | Use                                  |
| ----------------- | --------- | ------------------------------------ |
| `--ink`           | `#14231F` | Body text, headings                  |
| `--ink-muted`     | `#5A6862` | Secondary text, captions             |
| `--paper`         | `#FCFCFA` | Page background                      |
| `--surface`       | `#E8EAE4` | Cards, wells, table stripes          |
| `--surface-2`     | `#F4F5F1` | Nested surfaces, `ReadOnlyFact` ground |
| `--primary`       | `#0A4034` | Primary buttons, links, active nav   |
| `--primary-hover` | `#0D5443` | Hover state                          |
| `--accent`        | `#A8451F` | One emphasis per screen, maximum. Focus ring. Donate text link. |
| `--rule`          | `#C8CCC2` | Hairlines, borders, dividers         |
| `--success`       | `#1F6F4A` | Present, payment received            |
| `--warning`       | `#8A6415` | Partial, pending, closing soon       |
| `--danger`        | `#8C2F1E` | Absent, no-show, failed, destructive |
| `--info`          | `#1F5A75` | Technical issue, neutral system messages |

**Rules**
- All text/background pairs ≥ 4.5:1 (WCAG AA). Large display text may sit at 3:1.
- `--accent` is never used for body text.
- No gradients anywhere.

---

## 3. Typography

| Role        | Face                              | Sizes (px)                               |
| ----------- | --------------------------------- | ---------------------------------------- |
| Display     | Newsreader 500/600                | 64 / 48 / 36                             |
| Heading     | Newsreader 600                    | 30 / 24 / 20                             |
| Body        | IBM Plex Sans 400                 | 18 / 16                                  |
| UI / label  | IBM Plex Sans 500                 | 14 / 13                                  |
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
  - Card: `0 1px 2px rgba(20,35,31,.06)`
  - Overlay: `0 8px 24px rgba(20,35,31,.12)`

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

- Durations: 120 ms micro · 200 ms default · 320 ms page/panel.
- Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- Scroll reveal: fade + 12 px rise, once, 60 ms stagger. Never on text the user is reading.
- `prefers-reduced-motion: reduce` → opacity only.
- Forbidden: parallax, auto-playing carousels, scroll-hijacking.

---

## 7. Imagery & iconography

- Real photography only. No stock image of a generic child at a laptop. Missing photo → arch-framed initial monogram on `--surface`.
- Instructor portraits: 1:1 source, riwāq arch mask, warm neutral background.
- Quran/Hadith never used as decoration and never overlaid on a photo — typography only, with full citation.
- Illustration: line-only, `--primary`, 1.5 px. No filled cartoon styles.
- Images: AVIF/WebP, explicit width/height, lazy below the fold, `priority` only on the hero.
- Icons: **Lucide only**, 1.5 px stroke, 24 px grid. Always paired with a label, except dense portal toolbars (then `aria-label` + tooltip).

---

## 8. Buttons

| Variant   | Use                                | Style                                                         |
| --------- | ---------------------------------- | ------------------------------------------------------------- |
| Primary   | One per view. Enrol, Donate, Save. | Filled `--primary`, white text, 8 px radius, 44 px min height |
| Secondary | Alternative action                 | 1 px `--primary` outline, transparent fill                    |
| Ghost     | Tertiary, in-table actions         | Text only, underline on hover                                 |
| Danger    | Destructive                        | Filled `--danger`, always behind a confirm dialog             |
| Link      | Inline in prose                    | `--primary`, underlined, 2 px offset                          |

All buttons: 44 × 44 px minimum hit area · focus ring 2 px `--accent`, 2 px offset · loading state replaces the label with a spinner and keeps the width fixed · no double submit.

On public pages, **Donate is a text link in `--accent`, never a filled button** — the filled slot belongs to enrolment.

---

## 9. Components (component-level rules)

- **States:** every component ships default / hover / focus-visible / active / disabled / loading / error / empty.
- **`ReadOnlyFact`:** `--surface-2` ground, no border, no focus ring, small system glyph. Must never look like a disabled input.
- **`AttendanceStatusBadge`:** exactly six statuses — Present (`--success`), Partial (`--warning`), Technical issue (`--info`), Student absent (`--danger`), Teacher no-show (`--danger`), Class not held (`--ink-muted`). Thresholds come from settings, never hard-coded.
- **`OverlapBar`:** teacher track, student track, overlap band in `--primary`; scheduled window marked with hairlines. Mobile: tracks stack, axis compresses to start/end labels.
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
