"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { getDb } from "@/db";
import { outboxAdapters } from "@/lib/server/enroll/config";
import { clientIp } from "@/lib/server/keys";
import { deliverOutbox } from "@/lib/server/outbox/outbox";
import { submitTeachCore, teachConfig } from "@/lib/server/teach";
import { EMPTY, type TeachErrors, type TeachInput } from "@/lib/teach/schema";

/*
 * /teach application action. The rules are in src/lib/server/teach.ts; this
 * reads the request, then sends the queued email and Telegram notice right
 * after the response (the cron retries what fails). The typed values always
 * come back, so a correction or a retry never loses an answer.
 */

export type TeachState =
  | { status: "idle"; values: TeachInput }
  | { status: "invalid"; values: TeachInput; errors: TeachErrors }
  | { status: "error"; values: TeachInput; message: string }
  | { status: "sent"; values: TeachInput };

const one = (data: FormData, name: string, max: number) => String(data.get(name) ?? "").slice(0, max);
const many = (data: FormData, name: string) =>
  data
    .getAll(name)
    .map((v) => String(v).slice(0, 60))
    .slice(0, 20);

function valuesOf(data: FormData): TeachInput {
  return {
    name: one(data, "name", 200),
    email: one(data, "email", 300),
    phone: one(data, "phone", 60),
    country: one(data, "country", 120),
    gender: one(data, "gender", 20),
    courses: many(data, "courses"),
    languages: many(data, "languages"),
    qualifications: many(data, "qualifications"),
    qualificationOther: one(data, "qualificationOther", 400),
    ijazah: one(data, "ijazah", 10),
    ijazahDetail: one(data, "ijazahDetail", 600),
    experience: one(data, "experience", 4000),
    availability: one(data, "availability", 2000),
    timeZone: one(data, "timeZone", 200),
    sampleUrl: one(data, "sampleUrl", 1000),
    references: one(data, "references", 2000),
    message: one(data, "message", 4000),
  };
}

export async function sendTeachApplication(_prev: TeachState, data: FormData): Promise<TeachState> {
  const values = valuesOf(data);
  const config = teachConfig();
  // The page shows no form in this case; this only guards a stale page.
  if (!config) return { status: "error", values, message: "Applications open soon. Please email us in the meantime." };

  const h = await headers();
  let result: Awaited<ReturnType<typeof submitTeachCore>>;
  try {
    result = await submitTeachCore(
      getDb(),
      { fields: values, honeypot: one(data, "website", 200), submitId: one(data, "submitId", 80), ip: clientIp((name) => h.get(name)) },
      { ...config, now: new Date() },
    );
  } catch (error) {
    console.error(`[teach] submit failed: ${(error as Error).message.slice(0, 200)}`);
    return { status: "error", values, message: "Something went wrong on our side, and your application was not sent. Please try again in a few minutes, or email us." };
  }
  switch (result.status) {
    case "invalid":
      return { status: "invalid", values, errors: result.errors };
    case "limited":
      return { status: "error", values, message: "You have sent several applications in the last hour. Please wait a little, or email us." };
    case "error":
      return { status: "error", values, message: "Please reload the page and send your application again." };
    case "ok":
      if (result.outboxIds.length) {
        after(async () => {
          try {
            const db = getDb();
            await deliverOutbox(db, await outboxAdapters(db), { ids: result.outboxIds });
          } catch (error) {
            console.error(`[outbox] teach delivery failed: ${(error as Error).message.slice(0, 200)}`);
          }
        });
      }
      return { status: "sent", values: EMPTY };
  }
}
