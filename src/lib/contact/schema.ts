/*
 * The /contact form's fields and rules: one source for the browser (blur and
 * submit checks) and the server action, so both say the same thing.
 */

/** What the message is about: the team inbox sorts by this (the subject line). */
export const TOPICS = [
  { value: "enrollment", label: "Classes and enrollment" },
  { value: "fees", label: "Fees and help with fees" },
  { value: "giving", label: "Donations and Zakat" },
  { value: "teaching", label: "Teaching with us" },
  { value: "other", label: "Something else" },
] as const;
export type Topic = (typeof TOPICS)[number]["value"];

export const NAME_MAX = 100;
export const MESSAGE_MAX = 4000;

export type ContactInput = { name: string; email: string; phone: string; topic: string; message: string };
export type ContactField = keyof ContactInput;
export type ContactErrors = Partial<Record<ContactField, string>>;

const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

export const checks: Record<ContactField, (v: string) => string | undefined> = {
  name: (v) => (!v.trim() ? "Enter your name." : v.trim().length > NAME_MAX ? `Keep your name under ${NAME_MAX} characters.` : undefined),
  email: (v) =>
    !v.trim() ? "Enter your email address." : v.trim().length > 254 || !EMAIL.test(v.trim()) ? "Enter an email address in the format name@example.com." : undefined,
  phone: (v) => (v.trim() && v.replace(/\D/g, "").length < 7 ? "Enter a phone number with its country code, or leave it empty." : undefined),
  topic: (v) => (TOPICS.some((t) => t.value === v) ? undefined : "Choose what your message is about."),
  message: (v) =>
    !v.trim() ? "Write your message." : v.length > MESSAGE_MAX ? `Keep your message under ${MESSAGE_MAX.toLocaleString("en-US")} characters.` : undefined,
};

export function validateContact(input: ContactInput): ContactErrors {
  const errors: ContactErrors = {};
  for (const field of Object.keys(checks) as ContactField[]) {
    const message = checks[field](input[field] ?? "");
    if (message) errors[field] = message;
  }
  return errors;
}

export const topicLabel = (value: string) => TOPICS.find((t) => t.value === value)?.label ?? "Something else";
