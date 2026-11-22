# Product

<!-- impeccable:product-schema 1 -->

> Product truth for ilmulquranus.org. Derived from `docs/spec/README.md` (spec v2.0, Aug 2026) and confirmed by the document owner on 19 Nov 2026. Visual rules live in `DESIGN.md`, not here.
>
> **Spec divergence.** The owner's answers on 19 Nov 2026 change five things in the spec. They are listed under *Decisions that supersede the spec*. Until `IlmulQuran-USA/iqu-web-platform` is updated to match, those five items follow this file, and the spec wins everywhere else.

## Platform

web

## Users

- **Parents and guardians (primary).** Muslim families in the United States and Canada choosing live Quran and Islamic classes for their children (Kids 5–12, Teens). They are handing over their children's religious education and need to trust the teachers. Over 60% of traffic is mobile, and most enrolments happen on a phone. Their questions, in order: *Who teaches?* · *Will the class times work in my time zone?* · *What does it cost, and can I get help?* · *What happens after I click?*
- **Adult learners and sisters.** Some enrol for themselves. Some need a female instructor. Brothers learn with male teachers. Sisters, and boys up to age 10, can learn with a female teacher. (Owner, 20 Nov 2026.)
- **Donors.** Supporters in the US and Canada giving sadaqah, Zakat or monthly support. They look for 501(c)(3) status, the EIN, where the money goes, and whether Zakat is handled correctly.
- **Students (portal).** They join classes, follow their Sabaq / Sabqi / Manzil progress, do homework, and read reports and certificates.
- **Teachers (portal).** Huffaz, Ulama and Mufti in Bangladesh who teach students in North America. They work in Dhaka time with the student's local time alongside, and they are often away from a desk. Their most-used screen is the class record after each class.
- **Admin and ops (portal).** A small team (5+). Their day starts on the live board and the flags queue. They also run registrations, scholarships, coupons, donations, reports and settings.

## Product Purpose

A Next.js rebuild of ilmulquranus.org that replaces WordPress. It has three parts: a public site, a staged enrolment funnel, and an authenticated portal for four roles.

Ilm-Ul-Quran USA is **a charity that teaches, not a commercial academy that happens to be Islamic.** The site has to bring in enrolments and donations side by side without either one weakening the other. A parent researching Hifz should never feel asked for money.

Success means:
1. Browsing parents become enrolled students.
2. Visitors become donors.
3. The quality of the teachers is visible.
4. Families have a home after they enrol.
5. The site looks like an institution, not a template.
6. Every class can be verified.

Non-goals for v1: a self-serve course marketplace, native apps, in-house video, and a public forum or social feed.

## Positioning

- **Qualified scholars teach every class.** Classes are live and led by Huffaz, Ulama and Mufti. Our teaching is hard to match on credentials, while commercial academies win on price and convenience.
- **A real 501(c)(3) that gives about half its seats away.** Listed prices are the full monthly fees; families who need help can ask for a reduced fee (30%, 45% or 50% off) or a full scholarship, and nearly half of students study free (owner, 22 Nov 2026). No discount applies to everyone. Donations go to the scholarship fund.
- **Attendance is measured, not reported.** Zoom join and leave events give the *overlap*, meaning the minutes teacher and student were in the class at the same time. Nobody marks attendance. A teacher cannot claim a class that did not happen, and a teacher no-show is shown as clearly as a student absence. Teacher pay is calculated from verified minutes.
- **Hifz is taught properly.** Sabaq / Sabqi / Manzil tracking matches how the classes are actually taught. We keep those terms and explain them once.

## Operating Context

- **Teaching:** Classes run on Zoom meetings owned by the organization. The portal hands out the join link and reads Zoom's webhook events. Until the Zoom API is connected, admins paste meeting links by hand, and everything downstream must work the same way.
- **Time zones:** Classes go from Bangladesh (Dhaka) to North American zones. Class times are the main practical objection families raise. Every time shown carries its zone label, using the year-round names ET, CT, MT, PT and AT (Atlantic), never CST/CDT/EST/EDT, which change with daylight saving. Teachers see two clocks, and a warning appears in the two weeks before each North American daylight-saving change.
- **Class times are flexible (owner, 20 Nov 2026).** There is no teaching-hours window; spec §7.1's "6 AM–11 PM" is superseded. Each family chooses its own start time, end time and time zone when it enrolls (the live enrollment form works this way), and a teacher is matched to that time.
- **Messaging (v1, confirmed):** The portal runs alongside the existing channels and does not replace them.
  - **Telegram** stays for admin and teacher alerts through the existing Google Apps Script bots (teacher scheduling, daily reports, class reminders, cutoff notices, no-show and not-held alerts).
  - **Families** get email and in-app notices from the portal.
  - **WhatsApp is manual only.** The admin uses a *Copy message* button and pastes the text into WhatsApp. There is no WhatsApp API.
  - Whether the portal later replaces Telegram is still open.
- **Donations:** Zeffy, synced into `iqu_zeffy_payments`. That table is the only record of giving.
- **Tuition billing:** Stripe checkout during enrolment, then charged monthly on the family's billing date (see Capabilities and open decision K1).
- **Other tools:** Brevo (email), Meta Ads (the Meta CAPI Lead event fires on enrolment confirmation, with deduplication), WordPress. The live site and the `iqu-registration` plugin stay the source for current data.
- **Existing data:** `iqu_registrations` (50 fields per enrolment), `iqu_zeffy_payments`, and `iqu_coupons`. The enrolment redesign changes how these are presented, not the data model.

## Capabilities and Constraints

**Public site:** home, course catalog and course detail (6 courses), instructor directory and profiles, about, why us, transparency and finances, impact, donate, programs (Summer Ilm Camp, Weekend Islamic School), camp results, blog, FAQ, contact, teach with us.

**Enrolment funnel (`/enroll`):** five steps (Student · Course · Schedule · Fees · Review), then a confirmation page. Progress autosaves. The Schedule step takes the family's preferred days, start time, end time and time zone (no slot grid; times are flexible). The Zakat scholarship has its own page (`/scholarship`).

**Portal:** student `/s/*`, parent `/p/*`, teacher `/t/*`, admin `/a/*`, all inside one shell. Attendance uses exactly six statuses: Present · Partial · Technical issue · Student absent · Teacher no-show · Class not held. Attendance thresholds are read from settings because they will be calibrated from three weeks of live data. Teachers request corrections, and admins approve them. Parents confirm the week's classes every Friday, and any family can report a problem with a class.

**Decisions that supersede the spec (owner, 19 Nov 2026):**
1. **Fees are published.** Course cards and pages show a from-price with a scholarship note. Real per-course fees already exist in the live `iqu-registration` WordPress plugin, which prices by course. Take fees from there and never invent one. Until they are connected, show `$XX`.
2. **No sibling discount.** Every child pays the full fee. *This conflicts with* spec §7.3 section 7, §7.11, §7.17 Step 4 and §7D.4 Billing. Do not build a sibling discount line, an auto-apply, or a sibling column in the fee table.
3. **Tuition is in USD only.** *This conflicts with* spec §9.2 ("note where CAD is accepted") for tuition. The donor FAQ question about giving in CAD (§7.10) is a Zeffy matter and is separate from this.
4. **The trial is the first month free.** After *Enroll for Free*, the guardian adds a card at Stripe checkout. Regular monthly billing follows, charged monthly on your billing date (open decision K1). *This conflicts with* spec §7.17 ("No payment is taken in this flow") and the Step 1 reassurance line *"No payment is required to start."* Copy must not claim that no card is needed. Say that nothing is charged during the free month.
5. **Home hero: Concept B is the default; A and C are selectable.** Admins edit the hero's layout, text, image and featured instructors without code, in the Next.js admin portal at /a/settings/home, built with the portal after the public site. Until then the hero is changed only in src/content/home-hero.ts.

**Hard constraints carried from the spec:**
- WCAG 2.1 AA.
- Mobile-first, checked at 375 and 1440.
- Performance budgets: LCP < 2.0 s, CLS < 0.05, INP < 150 ms, marketing-route JS < 180 KB gz.
- English first, with copy structured so Bengali and Arabic can be added without a redesign.
- Dates are written as `30 Aug 2026`, with the Hijri date where it means something.
- Name fields accept Unicode and long, four-part names.

**Never build:** Join / Not Join buttons, start and end time inputs, teacher Present / Absent selection, "Mark class as completed", class recordings, or any automated WhatsApp send.

**Open items for the enrolment funnel:**
- The time-zone picker must offer Eastern, Central, Mountain, Pacific and Atlantic as year-round zones. The live form lacks Mountain and Atlantic and splits Central into CST and CDT.

**Open product decisions (do not resolve silently):**
- Whether the portal replaces Telegram after v1.
- How the first-month-free trial works for reduced-fee and Zakat scholarship families: is a card still required, and what do they pay after the first month?
- **K1 · Billing date** (CONTENT-ADDENDUM.md §7). The published Tuition Policy (16 Nov 2026) charges each family on its own billing date (the day the free month ends), which can be moved on request; this file and the site's FAQ used to say "charged on the 1st of each month". Until the owner decides, all copy says "charged monthly on your billing date". This also settles or replaces the old question of how the first month lines up with a 1st-of-month cycle (proration).
- Whether Bengali launches as a second locale in v1 or v2 (§10.3 Q6).
- Whether parents see exact minutes or only a status (§10.3 Q7).
- Who may approve a correction (§10.3 Q8).
- Whether a donation tab stays inside the student and teacher portals (§10.3 Q9).
- How long raw Zoom events are kept (§10.3 Q10).
- The attendance thresholds (§10.3 Q4, set from Phase 0 data).

**Closed decisions:**
- **K2 · Phone number** (CONTENT-ADDENDUM.md §7), closed by the owner, 22 Nov 2026: +1 (214) 529-3544 is correct (the live Contact page and the enrollment plugin). The (214) 662-1591 on the live About page is outdated; never use it.

## Brand Commitments

- **Name and entity:** Ilm-Ul-Quran USA, the trading name of AL HASANAH FOUNDATION · 501(c)(3) · EIN 93-3902300 · 100 N Central Expy Suite 914, Richardson, TX 75080 · ilmulquranus.org. The tax ID sits next to every donation ask and appears in the footer identity column.
- **Voice:** warm, respectful and professional, suited to an Islamic educational nonprofit. Clear, simple English. Dignified about money: asking for help must never make a family feel audited, and must never affect a child's place.
- **Islamic etiquette:** Quran and Hadith appear as typography with a full citation, in their own right-to-left block, never as decoration and never over a photo. Islamic topics are treated with respect.
- **Honesty:** no countdowns or false scarcity (the one exception is a real Summer Camp registration deadline). No stock photos of a child at a laptop. Nothing that looks like an SEO-farm academy.
- **Testimonials and sample content (owner, 21 Nov 2026):** Testimonials and sample content are shown for admin review; replace or confirm them before the public launch. They carry the status `sample`, render everywhere without a badge, and `npm run content:check` lists them under "Sample content to replace" (a warning, never a build failure). Before launch, every testimonial must be a real parent's own words, given with consent (US FTC rule on fake reviews and testimonials, 16 CFR Part 465). Never star ratings or review counts.
- **Spelling (owner, 21 Nov 2026):** always write Quran (no apostrophe), and Quranic, everywhere: UI copy, headings, metadata, alt text, structured data, content, tests and comments. Course names follow: Quran Hifz, Quran Nazirah, Tarjumatul Quran. The organisation name stays Ilm-Ul-Quran USA.
- **Teacher titles (owner, 21–22 Nov 2026):** Najiba Mahzabin Jeba (`/instructors/najiba-mahzabin-jeba`), Maha Rashed (`/instructors/maha-rashed`) and Alauddin Khilzi (`/instructors/alauddin-khilzi`) are written with no title; their old slugs 301 to these paths (`src/content/legacy-paths.ts`). Every other title (Mufti, Mawlana, Hafez, Hafezah) stays.
- **Enrolment and giving stay apart:** On public pages Donate is an outlined button with a short animated border (it stops after 3 laps and is static under reduced motion). Log in is a tonal button. Enrolment keeps the only filled button.

## Evidence on Hand

**Real and usable now:**
- Six courses with consistent meta fields: Noorani Qaidah, Quran Nazirah, Hifz, Quranic Arabic Mastery L1, Weekend Islamic Education, Summer Islamic Education.
- Twenty instructor entries, with name and job title only.
- Approximate scale figures: about 250 students, 25+ instructors, nearly half studying free.
- Data tables: `iqu_registrations` (81 rows), `iqu_zeffy_payments` (63 rows, live sync), `iqu_coupons` (3 rows).
- Per-course fees in the live `iqu-registration` plugin.
- The Summer Ilm Camp 2026 results.
- Rank Math Course and Organization schema.

**Absent, so never fabricate it (spec §8):**
- Instructor portraits, bios, credentials and recitation audio. Use the arch-framed monogram until these exist.
- Testimonials with consent.
- Photographs of real classes and students.
- Where-the-money-goes figures.
- The IRS determination letter.
- FAQ content.
- Course outcome statements and curriculum breakdowns.
- Real slot availability.
- Leadership bios.
- Notification wording.
- Ratings or review counts. Show an honest empty state instead.

**Logo:** No logo or brand mark is in the repo yet. `public/` holds only Next.js scaffold SVGs.

## Product Principles

1. **A charity that teaches.** Enrolment and giving tell two separate stories and should never get in each other's way.
2. **Show evidence, not claims.** Show real credentials, real figures and verified minutes. Use `$XX` and `[pending]` placeholders before inventing anything.
3. **Dignity around money.** Prices are shown openly, help is offered plainly, and scholarship families never see a $0 invoice.
4. **The system states facts and people add judgement.** Attendance is a fact the system reports. What teachers write is the editable part.
5. **Time-zone honesty everywhere.** No time appears without its zone.

## Accessibility & Inclusion

- WCAG 2.1 AA as a minimum.
- Hit targets of at least 44 × 44 px.
- A visible focus ring that is never removed.
- Zoom is never disabled.
- Labels stay visible. Fields are validated on blur, with an error summary that links to each field and an `aria-live` announcement.
- Arabic blocks are tested inside otherwise left-to-right pages.
- `prefers-reduced-motion` is honoured.
- Users include parents on phones, teachers away from a desk, and families whose first language may be Bengali, Urdu or Arabic.
