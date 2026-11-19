"use server";

/**
 * Footer newsletter sign-up (spec §6.2). It replaces the orphaned /enroll
 * newsletter page.
 *
 * NOT CONNECTED: the Brevo list and API key have not been set up for this app.
 * Until they are, this action validates the address and then says plainly
 * that sign-up is unavailable. It never reports a success that did not happen.
 *
 * The submitted email always comes back in the state, so the field keeps what
 * the person typed when React resets the form after the action.
 */

export type NewsletterState =
  | { status: "idle"; email: string }
  | { status: "error"; email: string; field?: "email"; message: string }
  | { status: "success"; email: string; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribeToNewsletter(
  _prev: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { status: "error", email, field: "email", message: "Enter your email address." };
  }
  if (!EMAIL.test(email)) {
    return {
      status: "error",
      email,
      field: "email",
      message: "Enter an email address in the format name@example.com.",
    };
  }

  // TODO(brevo): add the contact to the newsletter list, then return
  // { status: "success", email: "", message: "You're subscribed. Check your inbox to confirm." }.
  return {
    status: "error",
    email,
    message: "Newsletter sign-up isn't open yet. Please check back soon.",
  };
}
