# Deployment

The site is hosted on Vercel. GitHub Actions checks the code; Vercel builds and serves it.

| Git event | Vercel environment | URL | Indexed? |
| --- | --- | --- | --- |
| Push / merge to `main` | Production | https://dev.ilmulquranus.org (staging) | Never |
| Pull request (every push to its branch) | Preview | `iqu-web-client-git-<branch>-<team>.vercel.app`, linked on the PR | Never |

The live public site stays on WordPress at https://ilmulquranus.org until launch. In Vercel terms our staging site is the **Production** environment. That is why staging is controlled by `NEXT_PUBLIC_SITE_ENV`, not by the Vercel environment name.

---

## 1. main → dev.ilmulquranus.org

1. A pull request is merged into `main` (or someone pushes to `main`).
2. Vercel's GitHub integration builds that commit (`npm run build`) and assigns it to the project's production domain, `dev.ilmulquranus.org`.
3. At the same time, the **CI** workflow (`.github/workflows/ci.yml`) runs on the same commit. Vercel does not wait for CI. Protect `main` (step 4 below) so broken code doesn't reach it in the first place.

If a deployment goes wrong: Vercel › Project › Deployments › pick the last good deployment › **Instant Rollback**.

## 2. Pull-request previews

- Every pull request gets its own preview deployment. The Vercel bot comments the URL on the PR and updates it on every push.
- Previews use the **Preview** environment variables (see §3).
- By default Vercel puts **Deployment Protection** (Vercel Authentication) in front of preview URLs, so only members of the Vercel team can open them. Keep it on. `dev.ilmulquranus.org` is the production domain, so that protection does not cover it. The noindex rules below do.

## 3. CI (GitHub Actions)

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request:

1. Checkout with the `docs/spec` submodule (recursive).
2. Node from `package.json` → `engines.node` (24.x), `npm ci` with the npm cache.
3. `npm run lint` → `next typegen` + `tsc --noEmit` → `npm run test:unit` → `npm run build`. Any failure fails the job.
4. `npm run content:check`: non-blocking. It prints the draft, pending and sample content still to replace before launch.

There is no Playwright in CI for now, to keep it fast. Run `npm run test:e2e` locally.

**Recommended:** GitHub › Settings › Branches › add a rule for `main`: require a pull request and require the status check **Lint, typecheck, test, build** to pass.

## 4. Environment variables (Vercel › Project › Settings › Environment Variables)

| Name | Production (dev.ilmulquranus.org) | Preview (PRs) | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_ENV` | `staging` | `staging` | Set to `production` **only** when this project serves the real public site. |
| `NEXT_PUBLIC_SITE_URL` | `https://dev.ilmulquranus.org` | `https://dev.ilmulquranus.org` | The origin for canonical and Open Graph URLs. `https://ilmulquranus.org` at launch. If unset, it follows `NEXT_PUBLIC_SITE_ENV`. |
| `BREVO_API_KEY` | set | leave unset* | Server only. |
| `BREVO_LIST_ID` | set | leave unset* | Numeric list id. |
| `BREVO_DOI_TEMPLATE_ID` | set | leave unset* | Numeric double opt-in template id. |
| `BREVO_REDIRECT_URL` | set | leave unset* | Full `https://` URL shown after the person confirms. |
| `BREVO_API_URL` | — | — | Tests only. Never set it on Vercel. |

\* With any Brevo variable missing, the footer shows "Sign-up opens soon." instead of the form. Leaving them unset on previews means a test sign-up on a PR can't add contacts to the real list. If you want to test the form on previews, use a separate Brevo test list.

`.env.example` lists the same names. Variables prefixed `NEXT_PUBLIC_` are read **at build time**, so after changing one, redeploy (Deployments › … › Redeploy).

### Staging is never indexed

Staging shows sample content and repeats text from the live WordPress site, so search engines must never index it. Unless `NEXT_PUBLIC_SITE_ENV` is exactly `production` (`src/lib/site-env.ts`):

- every page carries `<meta name="robots" content="noindex, nofollow">` (`src/lib/metadata.ts`);
- every response, pages and static files alike, sends `X-Robots-Tag: noindex, nofollow` (`next.config.ts` › `headers`);
- no sitemap is served: `/sitemap*.xml` and `/sitemap/*` answer 404 (`next.config.ts` › `rewrites`).

`/robots.txt` is `User-Agent: *` / `Allow: /` on staging too (`src/app/robots.ts`). That is deliberate: Google can only see a noindex on a page it may crawl, and link-preview bots (Facebook, WhatsApp, LinkedIn, X, Telegram, Slack) honour robots.txt, so a `Disallow` would break link previews without keeping pages out of the index.

A missing, empty or misspelt value counts as staging, so a misconfiguration can't expose staging. To check a deployment:

```sh
curl -s https://dev.ilmulquranus.org/robots.txt          # Allow: /
curl -s https://dev.ilmulquranus.org/ | grep -o '<meta name="robots"[^>]*>' # noindex, nofollow
curl -sI https://dev.ilmulquranus.org/ | grep -i x-robots # noindex, nofollow
```

## 5. Domain and DNS

1. Vercel › Project › Settings › Domains › add `dev.ilmulquranus.org` and assign it to the **Production** environment (branch `main`). Under Settings › Git, make sure the production branch is `main`.
2. At the DNS provider for `ilmulquranus.org`, add **one** record. Do not change the apex (`@`) or `www` records, which still point to WordPress.

   | Type | Name / Host | Value | TTL |
   | --- | --- | --- | --- |
   | CNAME | `dev` | `cname.vercel-dns.com` | Auto / 3600 |

   If the Domains page shows a different, project-specific target (for example `xxxxxxxx.vercel-dns-017.com`), use that value. If Vercel asks for a TXT record `_vercel` to verify ownership (this happens when the domain is already used by another Vercel account), add it as well.
3. If the DNS is behind Cloudflare, set the `dev` record to **DNS only** (grey cloud) so Vercel can issue the TLS certificate.
4. Vercel issues the HTTPS certificate on its own once the record resolves. This usually takes a few minutes.

## 5a. Cron jobs

Scheduled jobs are Vercel Cron entries in `vercel.json`. Vercel calls each path with `GET` and `Authorization: Bearer $CRON_SECRET`. Every route refuses other callers (401), does nothing without `DATABASE_URL` (503), and is safe to run twice.

**Hobby plan (now): once a day only.** A schedule that runs more often makes the deploy fail, so `vercel.json` holds daily schedules only. Hobby may also start a job at any minute within its hour, so the 9 PM summary can arrive up to an hour late.

| Path | Schedule (UTC) | Dhaka time | What it does |
| --- | --- | --- | --- |
| `/api/cron/reminders` | `0 14 * * *` | 20:00 | Card reminders at 24 h and 72 h; `card_pending` → `expired` after 7 days (audit log). Plugin: hourly. |
| `/api/cron/daily-summary` | `0 15 * * *` | 21:00 | The one 9 PM Telegram summary (registrations, tuition, donations). |
| `/api/cron/ledger` | `30 18 * * *` | 00:30 | Zakat and Special ledger rows for the current Dhaka month, so the 1st is written on the 1st. |
| `/api/cron/outbox` | `0 3 * * *` | 09:00 | A daily safety net for Telegram and email sends that failed. |

Outside production, Telegram goes only to the test chat (`TELEGRAM_CHAT_ID`, never the live chat pattern in `settings`), and email only to `EMAIL_ALLOWLIST`.

Run a job by hand:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" https://dev.ilmulquranus.org/api/cron/daily-summary
```

**Enable after Vercel Pro.** Do not add these to `vercel.json` before the project is on Pro. On Pro, replace the `reminders` and `outbox` entries with the lines below, and add the Stripe sync when P2 ships:

```jsonc
// vercel.json › crons — Vercel Pro only (sub-daily schedules)
// { "path": "/api/cron/outbox",      "schedule": "*/5 * * * *" },  // outbox retries: 1, 5, 30 min
// { "path": "/api/cron/reminders",   "schedule": "5 * * * *" },    // hourly, as the plugin (iqu_enroll_reminders)
// { "path": "/api/cron/stripe-sync", "schedule": "15 * * * *" },   // P2: hourly missed-webhook safety net
```

## 6. Git submodule (docs/spec)

`docs/spec` is a submodule of the public repo `IlmulQuran-USA/iqu-web-platform`, with an `https://` URL in `.gitmodules`. Vercel and GitHub Actions both clone it without credentials. The build doesn't read it (only `npm run content:check` does), so a submodule problem can't break a deployment. If the spec repo ever becomes private, Vercel can no longer clone it. Either keep the spec public, or check that the build still passes without it.

## 7. Going live later (not now)

When this project replaces WordPress at `ilmulquranus.org`:

1. Set `NEXT_PUBLIC_SITE_ENV=production` and `NEXT_PUBLIC_SITE_URL=https://ilmulquranus.org` for the environment that serves the public domain only, never for previews, and redeploy.
2. Add a sitemap and the `Sitemap:` line in `src/app/robots.ts`.
3. Keep `dev.ilmulquranus.org` on a separate project or environment with `staging`, so it stays out of search results.
