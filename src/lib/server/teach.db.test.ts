import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../db/schema.ts";
import type { AnyDb } from "../../db/types.ts";
import { EMPTY, validateTeach, type TeachInput } from "../teach/schema.ts";
import { parseAllowlist, resetGmailTokenCache, type GmailConfig } from "./outbox/gmail.ts";
import { deliverOutbox } from "./outbox/outbox.ts";
import type { TelegramConfig } from "./outbox/telegram.ts";
import { submitTeachCore, teachConfig } from "./teach.ts";

/*
 * /teach on PGlite: the shared rules (conditional fields included), one
 * application row plus an email (Reply-To the applicant) and a Telegram notice
 * in the outbox, the honeypot, one application per submit id, the HMAC rate
 * limits, and the P1 staging guards on delivery. No network: Gmail and
 * Telegram are fakes.
 */

const { outbox, rateLimits, teachApplications } = schema;
let client: PGlite;
let db: AnyDb;

before(async () => {
  client = await PGlite.create();
  const dir = join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await client.exec(readFileSync(join(dir, file), "utf8").replaceAll("--> statement-breakpoint", ""));
  }
  db = drizzle(client, { schema }) as unknown as AnyDb;
});
after(async () => {
  await client.close();
});
beforeEach(async () => {
  const tables = (await client.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)).rows.map((r) => `"${r.tablename}"`);
  await client.exec(`TRUNCATE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
});

const NOW = new Date("2026-11-27T10:00:00Z");
const SECRET = "teach-secret-0123456789abcdef0123456789ab";
const deps = { hashSecret: SECRET, teamInbox: "ilmulquranusa@gmail.com", now: NOW };
const fields = (over: Partial<TeachInput> = {}): TeachInput => ({
  ...EMPTY,
  name: "Hafez Abdullah Example",
  email: "teacher@example.com",
  phone: "+880 1711 000000",
  country: "Bangladesh",
  gender: "male",
  courses: ["quran-hifz", "quran-nazirah"],
  languages: ["bengali", "english"],
  qualifications: ["hafez", "alim"],
  ijazah: "yes",
  ijazahDetail: "Hafs an Asim, from Shaykh Example",
  experience: "Six years teaching Hifz.\nOnline since 2021.",
  availability: "Monday to Thursday, 6–10 PM",
  timeZone: "Dhaka",
  sampleUrl: "https://drive.google.com/file/d/example",
  ...over,
});
let seq = 0;
const sid = () => `teach-${String(++seq).padStart(12, "0")}`;
const send = (over: Partial<TeachInput> = {}, opts: { honeypot?: string; submitId?: string; ip?: string; at?: Date } = {}) =>
  submitTeachCore(db, { fields: fields(over), honeypot: opts.honeypot ?? "", submitId: opts.submitId ?? sid(), ip: opts.ip ?? "203.0.113.9" }, { ...deps, now: opts.at ?? NOW });

test("open only with the Gmail mailer, the database and the hash secret (else 'Applications open soon')", () => {
  const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;
  const gmail = { GMAIL_CLIENT_ID: "id", GMAIL_CLIENT_SECRET: "s", GMAIL_REFRESH_TOKEN: "r", GMAIL_SENDER: "ilmulquranusa@gmail.com" };
  assert.deepEqual(teachConfig(env({ ...gmail, DATABASE_URL: "postgres://x", IQU_HASH_SECRET: SECRET })), { hashSecret: SECRET, teamInbox: "ilmulquranusa@gmail.com" });
  assert.equal(teachConfig(env({ DATABASE_URL: "postgres://x", IQU_HASH_SECRET: SECRET })), null, "no GMAIL_*");
  assert.equal(teachConfig(env({ ...gmail, IQU_HASH_SECRET: SECRET })), null, "no database");
  assert.equal(teachConfig(env({})), null);
});

test("the rules: every required answer, and the two that depend on another", () => {
  assert.deepEqual(validateTeach(EMPTY), {
    name: "Enter your full name.",
    email: "Enter your email address.",
    phone: "Enter your WhatsApp number.",
    country: "Enter the country you live in.",
    gender: "Choose male or female.",
    courses: "Choose at least one course you can teach.",
    languages: "Choose at least one language you can teach in.",
    qualifications: "Choose at least one qualification.",
    ijazah: "Choose yes or no.",
    experience: "Describe your teaching experience.",
    availability: "Write the days and hours you can teach.",
    timeZone: "Enter the city or time zone you will teach from.",
  });
  assert.deepEqual(validateTeach(fields()), {});
  // "Other" needs its text; "Yes" needs from whom.
  assert.deepEqual(validateTeach(fields({ qualifications: ["other"], ijazahDetail: "" })), {
    qualificationOther: "Write your other qualification.",
    ijazahDetail: "Write from whom, and for which recitation.",
  });
  assert.deepEqual(validateTeach(fields({ ijazah: "no", ijazahDetail: "" })), {});
  // Only known options, https links, sane lengths.
  assert.deepEqual(validateTeach(fields({ courses: ["astrology"], gender: "other", sampleUrl: "http://x.example", phone: "12" })), {
    phone: "Enter your WhatsApp number with its country code.",
    gender: "Choose male or female.",
    courses: "Choose at least one course you can teach.",
    sampleUrl: "Enter a link that starts with https://.",
  });
  assert.equal(validateTeach(fields({ experience: "x".repeat(2001) })).experience, "Keep this under 2,000 characters.");
});

test("an application is saved, then an email to the team (Reply-To the applicant) and a Telegram notice are queued", async () => {
  const r = await send();
  assert.equal(r.status, "ok");
  const [row] = await db.select().from(teachApplications);
  assert.equal(row.name, "Hafez Abdullah Example");
  assert.deepEqual(row.courses, ["quran-hifz", "quran-nazirah"]);
  assert.deepEqual(row.qualifications, ["hafez", "alim"]);
  assert.equal(row.ijazah, true);
  assert.equal(row.status, "new");
  assert.equal(row.referees, null);
  const rows = await db.select().from(outbox);
  assert.deepEqual(rows.map((x) => x.kind).sort(), ["email", "telegram"]);
  const email = rows.find((x) => x.kind === "email")!.payload as { to: string; replyTo: string; subject: string; text: string; template: string };
  assert.deepEqual([email.template, email.to, email.replyTo], ["teach_application", "ilmulquranusa@gmail.com", "teacher@example.com"]);
  assert.equal(email.subject, `[Ilm-Ul-Quran USA] Teacher application #${row.id} — Hafez Abdullah Example`);
  assert.match(email.text, /Can teach: Quran Hifz, Quran Nazirah/);
  assert.match(email.text, /Six years teaching Hifz\./);
  const tg = rows.find((x) => x.kind === "telegram")!.payload as { html: string };
  assert.match(tg.html, /New Teacher Application/);
  assert.match(tg.html, /Languages: <b>Bengali, English<\/b>/);
  assert.match(tg.html, /Ijazah or sanad: <b>Yes — Hafs an Asim/);
  // Rate-limit keys are HMACs: no IP and no email in the table.
  const keys = (await db.select().from(rateLimits)).map((k) => k.key);
  assert.ok(keys.length === 2 && keys.every((k) => /^teach(ip|email):[a-f0-9]{32}$/.test(k)));
});

test("an answer that depends on another is dropped when that answer changes", async () => {
  await send({ qualifications: ["hafez"], qualificationOther: "left over", ijazah: "no", ijazahDetail: "left over" });
  const [row] = await db.select().from(teachApplications);
  assert.equal(row.qualificationOther, null);
  assert.equal(row.ijazahDetail, null);
});

test("honeypot: a bot gets the thank-you; nothing is saved, queued or counted", async () => {
  assert.deepEqual(await send({}, { honeypot: "http://spam.example" }), { status: "ok", applicationId: null, outboxIds: [] });
  assert.equal((await db.select().from(teachApplications)).length, 0);
  assert.equal((await db.select().from(outbox)).length, 0);
  assert.equal((await db.select().from(rateLimits)).length, 0);
});

test("the same application sent twice (same submit id): one row, one email, one notice, counted once", async () => {
  const id = sid();
  const a = await send({}, { submitId: id });
  const b = await send({}, { submitId: id });
  assert.equal(a.status === "ok" && a.outboxIds.length, 2);
  assert.deepEqual(b, { status: "ok", applicationId: null, outboxIds: [] });
  assert.equal((await db.select().from(teachApplications)).length, 1);
  assert.equal((await db.select().from(outbox)).length, 2);
  assert.deepEqual(await send({}, { submitId: "bad id!" }), { status: "error", code: "bad_submit_id" });
});

test("invalid input is refused before anything is written", async () => {
  const r = await send({ email: "nope", courses: [] });
  assert.equal(r.status, "invalid");
  assert.equal((await db.select().from(teachApplications)).length, 0);
});

test("rate limits: 2 an hour per email, 3 per IP; a refused application is not saved; a new hour starts again", async () => {
  for (let i = 0; i < 2; i++) assert.equal((await send()).status, "ok");
  assert.deepEqual(await send(), { status: "limited" });
  assert.equal((await db.select().from(teachApplications)).length, 2, "the refused application was rolled back");
  assert.equal((await db.select().from(outbox)).length, 4);
  assert.equal((await send({ email: "other@example.com" })).status, "ok");
  assert.deepEqual(await send({ email: "fourth@example.com" }), { status: "limited" }, "the IP's fourth application");
  assert.equal((await send({ email: "fourth@example.com" }, { ip: "198.51.100.4" })).status, "ok", "another connection");
  assert.equal((await send({}, { at: new Date(NOW.getTime() + 3_600_000) })).status, "ok", "the next hour");
});

test("staging guards (P1): email only to EMAIL_ALLOWLIST, Telegram only to the test chat", async () => {
  const r = await send();
  const ids = r.status === "ok" ? r.outboxIds : [];
  resetGmailTokenCache();
  const sent: string[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
    if (String(url).includes("api.telegram.org")) {
      sent.push(`telegram:${JSON.parse(String(init?.body)).chat_id}`);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    sent.push(Buffer.from(JSON.parse(String(init?.body)).raw, "base64url").toString("utf8"));
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const gmail: GmailConfig = { clientId: "id", clientSecret: "s", refreshToken: "r", sender: "ilmulquranusa@gmail.com", production: false, allowlist: parseAllowlist("tester@example.org") };
  // Staging with no live chat pattern named: Telegram fails closed.
  const telegram: TelegramConfig = { token: "t", chatId: "-100test", production: false, liveChatPattern: null };
  const result = await deliverOutbox(db, { telegram, gmail, fromName: "Ilm-Ul-Quran USA", fetchImpl }, { ids, now: NOW });
  assert.deepEqual([result.sent, result.skipped, sent.length], [0, 2, 0]);
});
