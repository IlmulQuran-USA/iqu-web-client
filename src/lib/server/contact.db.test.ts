import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../db/schema.ts";
import type { AnyDb } from "../../db/types.ts";
import { validateContact, type ContactInput } from "../contact/schema.ts";
import { contactConfig, submitContactCore } from "./contact.ts";
import { buildMime, parseAllowlist, resetGmailTokenCache, type GmailConfig } from "./outbox/gmail.ts";
import { deliverOutbox } from "./outbox/outbox.ts";

/*
 * /contact on PGlite: the form's rules, the Gmail outbox row with Reply-To,
 * the honeypot, one email per message, the HMAC rate limits and the staging
 * EMAIL_ALLOWLIST guard (P1). No network: Gmail is a fake.
 */

const { outbox, rateLimits } = schema;
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

const NOW = new Date("2026-11-26T10:00:00Z");
const SECRET = "contact-secret-0123456789abcdef0123456789";
const deps = { hashSecret: SECRET, teamInbox: "ilmulquranusa@gmail.com", now: NOW };
const fields = (over: Partial<ContactInput> = {}): ContactInput => ({
  name: "Sadia Zq",
  email: "parent@example.com",
  phone: "+1 214 555 0100",
  topic: "fees",
  message: "Assalamu alaikum.\nCould we talk about help with fees?",
  ...over,
});
let seq = 0;
const sid = () => `contact-${String(++seq).padStart(12, "0")}`;
const send = (over: Partial<ContactInput> = {}, opts: { honeypot?: string; submitId?: string; ip?: string; at?: Date } = {}) =>
  submitContactCore(db, { fields: fields(over), honeypot: opts.honeypot ?? "", submitId: opts.submitId ?? sid(), ip: opts.ip ?? "203.0.113.9" }, { ...deps, now: opts.at ?? NOW });

test("open only with the Gmail mailer, the database and the hash secret (else 'Message form opens soon')", () => {
  const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;
  const gmail = { GMAIL_CLIENT_ID: "id", GMAIL_CLIENT_SECRET: "s", GMAIL_REFRESH_TOKEN: "r", GMAIL_SENDER: "ilmulquranusa@gmail.com" };
  assert.deepEqual(contactConfig(env({ ...gmail, DATABASE_URL: "postgres://x", IQU_HASH_SECRET: SECRET })), { hashSecret: SECRET, teamInbox: "ilmulquranusa@gmail.com" });
  assert.equal(contactConfig(env({ DATABASE_URL: "postgres://x", IQU_HASH_SECRET: SECRET })), null, "no GMAIL_*");
  assert.equal(contactConfig(env({ ...gmail, IQU_HASH_SECRET: SECRET })), null, "no database");
  assert.equal(contactConfig(env({ ...gmail, DATABASE_URL: "postgres://x", IQU_HASH_SECRET: "short" })), null, "no usable hash secret");
  assert.equal(contactConfig(env({})), null);
});

test("the form's rules: every field message, the same in the browser and on the server", () => {
  assert.deepEqual(validateContact({ name: "", email: "", phone: "", topic: "", message: "" }), {
    name: "Enter your name.",
    email: "Enter your email address.",
    topic: "Choose what your message is about.",
    message: "Write your message.",
  });
  assert.deepEqual(validateContact(fields({ email: "not-an-email", phone: "12", topic: "press", message: "x".repeat(4001) })), {
    email: "Enter an email address in the format name@example.com.",
    phone: "Enter a phone number with its country code, or leave it empty.",
    topic: "Choose what your message is about.",
    message: "Keep your message under 4,000 characters.",
  });
  assert.deepEqual(validateContact(fields({ phone: "" })), {}, "the phone is optional");
});

test("a message becomes one Gmail outbox row to the team inbox, Reply-To the visitor; nothing else is stored", async () => {
  const r = await send();
  assert.equal(r.status, "ok");
  const [row] = await db.select().from(outbox);
  const p = row.payload as { to: string; replyTo: string; subject: string; text: string; template: string };
  assert.deepEqual([row.kind, p.template, p.to, p.replyTo], ["email", "contact_form", "ilmulquranusa@gmail.com", "parent@example.com"]);
  assert.equal(p.subject, "[Ilm-Ul-Quran USA] Contact form: Fees and help with fees — Sadia Zq");
  assert.match(p.text, /Could we talk about help with fees\?/);
  assert.match(p.text, /Received: 26 Nov 2026, 4:00 PM Dhaka time/);
  // Rate-limit keys are HMACs: no IP and no email in the table.
  const keys = (await db.select().from(rateLimits)).map((k) => k.key);
  assert.equal(keys.length, 2);
  assert.ok(keys.every((k) => /^contact(ip|email):[a-f0-9]{32}$/.test(k)));
  assert.ok(!JSON.stringify(keys).includes("203.0.113.9") && !JSON.stringify(keys).includes("parent@example.com"));
});

test("honeypot: a bot gets the thank-you; nothing is queued or counted", async () => {
  assert.deepEqual(await send({}, { honeypot: "http://spam.example" }), { status: "ok", outboxIds: [] });
  assert.equal((await db.select().from(outbox)).length, 0);
  assert.equal((await db.select().from(rateLimits)).length, 0);
});

test("the same message sent twice (same submit id) queues one email and counts once", async () => {
  const id = sid();
  const a = await send({}, { submitId: id });
  const b = await send({}, { submitId: id });
  assert.equal(a.status === "ok" && a.outboxIds.length, 1);
  assert.deepEqual(b, { status: "ok", outboxIds: [] });
  assert.equal((await db.select().from(outbox)).length, 1);
  assert.equal((await db.select().from(rateLimits)).reduce((s, k) => s + k.count, 0), 2);
  assert.deepEqual(await send({}, { submitId: "bad id!" }), { status: "error", code: "bad_submit_id" });
});

test("rate limits: 3 an hour per email, 5 per IP; a refused message is not queued; a new hour starts again", async () => {
  for (let i = 0; i < 3; i++) assert.equal((await send()).status, "ok");
  assert.deepEqual(await send(), { status: "limited" });
  assert.equal((await db.select().from(outbox)).length, 3, "the refused message was rolled back");
  for (let i = 0; i < 2; i++) assert.equal((await send({ email: `other${i}@example.com` })).status, "ok");
  assert.deepEqual(await send({ email: "sixth@example.com" }), { status: "limited" }, "the IP's sixth message");
  assert.equal((await send({ email: "sixth@example.com" }, { ip: "198.51.100.4" })).status, "ok", "another connection");
  assert.equal((await send({}, { at: new Date(NOW.getTime() + 3_600_000) })).status, "ok", "the next hour");
});

test("staging guard (P1): the team inbox receives only when it is on EMAIL_ALLOWLIST; the MIME carries Reply-To", async () => {
  const r = await send();
  const ids = r.status === "ok" ? r.outboxIds : [];
  resetGmailTokenCache();
  const sent: string[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
    sent.push(Buffer.from(JSON.parse(String(init?.body)).raw, "base64url").toString("utf8"));
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const gmail = (allow: string): GmailConfig => ({ clientId: "id", clientSecret: "s", refreshToken: "r", sender: "ilmulquranusa@gmail.com", production: false, allowlist: parseAllowlist(allow) });

  const refused = await deliverOutbox(db, { telegram: null, gmail: gmail("tester@example.org"), fromName: "Ilm-Ul-Quran USA", fetchImpl }, { ids, now: NOW });
  assert.deepEqual([refused.sent, refused.skipped, sent.length], [0, 1, 0]);

  const r2 = await send({ email: "second@example.com" });
  const ok = await deliverOutbox(db, { telegram: null, gmail: gmail("ilmulquranusa@gmail.com"), fromName: "Ilm-Ul-Quran USA", fetchImpl }, { ids: r2.status === "ok" ? r2.outboxIds : [], now: NOW });
  assert.equal(ok.sent, 1);
  assert.match(sent[0], /\r\nReply-To: second@example\.com\r\n/);
  assert.match(sent[0], /\r\nTo: ilmulquranusa@gmail\.com\r\n/);
});

test("Reply-To can never inject a header or carry more than one address", () => {
  const base = { from: "a@example.com", fromName: "IQU", to: "b@example.com", subject: "s", html: "<p>x</p>", text: "x" };
  assert.throws(() => buildMime({ ...base, replyTo: "x@example.com\r\nBcc: evil@example.com" }), /Header injection refused/);
  assert.throws(() => buildMime({ ...base, replyTo: "a@example.com, b@example.com" }), /one plain address/);
  assert.match(buildMime({ ...base, replyTo: "ok@example.com" }), /Reply-To: ok@example\.com/);
  assert.doesNotMatch(buildMime(base), /Reply-To/);
});
