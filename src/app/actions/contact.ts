"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { getDb } from "@/db";
import type { ContactErrors, ContactInput } from "@/lib/contact/schema";
import { contactConfig, submitContactCore } from "@/lib/server/contact";
import { outboxAdapters } from "@/lib/server/enroll/config";
import { clientIp } from "@/lib/server/keys";
import { deliverOutbox } from "@/lib/server/outbox/outbox";

/*
 * /contact form action. The rules are in src/lib/server/contact.ts; this
 * reads the request, then sends the queued email right after the response
 * (the cron retries what fails). The typed values always come back, so a
 * correction or a retry never loses the message.
 */

export type ContactState =
  | { status: "idle"; values: ContactInput }
  | { status: "invalid"; values: ContactInput; errors: ContactErrors }
  | { status: "error"; values: ContactInput; message: string }
  | { status: "sent"; values: ContactInput };

const field = (data: FormData, name: string, max: number) => String(data.get(name) ?? "").slice(0, max);

export async function sendContactMessage(_prev: ContactState, data: FormData): Promise<ContactState> {
  const values: ContactInput = {
    name: field(data, "name", 200),
    email: field(data, "email", 300),
    phone: field(data, "phone", 40),
    topic: field(data, "topic", 40),
    message: field(data, "message", 5000),
  };
  const config = contactConfig();
  // The page shows no form in this case; this only guards a stale page.
  if (!config) return { status: "error", values, message: "Message form opens soon. Please call, text, WhatsApp or email us." };

  const h = await headers();
  let result: Awaited<ReturnType<typeof submitContactCore>>;
  try {
    result = await submitContactCore(
      getDb(),
      { fields: values, honeypot: field(data, "website", 200), submitId: field(data, "submitId", 80), ip: clientIp((name) => h.get(name)) },
      { ...config, now: new Date() },
    );
  } catch (error) {
    // Our side failed (the database, say): say so, keep the message, and offer the other channels.
    console.error(`[contact] submit failed: ${(error as Error).message.slice(0, 200)}`);
    return { status: "error", values, message: "Something went wrong on our side, and your message was not sent. Please try again in a few minutes, or call or email us." };
  }
  switch (result.status) {
    case "invalid":
      return { status: "invalid", values, errors: result.errors };
    case "limited":
      return { status: "error", values, message: "You have sent several messages in the last hour. Please wait a little, or call or email us." };
    case "error":
      return { status: "error", values, message: "Please reload the page and send your message again." };
    case "ok":
      if (result.outboxIds.length) {
        after(async () => {
          try {
            const db = getDb();
            await deliverOutbox(db, await outboxAdapters(db), { ids: result.outboxIds });
          } catch (error) {
            console.error(`[outbox] contact delivery failed: ${(error as Error).message.slice(0, 200)}`);
          }
        });
      }
      return { status: "sent", values: { name: "", email: "", phone: "", topic: "", message: "" } };
  }
}
