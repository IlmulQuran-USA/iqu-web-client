"use client";

/*
 * reCAPTCHA v3 in the browser (owner decision 20). The Google script loads
 * only when a token is first needed (the Review step, or Apply on a
 * scholarship code), so it never weighs on the first load of /enroll.
 */

type Grecaptcha = { ready: (cb: () => void) => void; execute: (key: string, opts: { action: string }) => Promise<string> };

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

let loading: Promise<Grecaptcha> | null = null;

export function loadRecaptcha(siteKey: string): Promise<Grecaptcha> {
  if (window.grecaptcha?.execute) return Promise.resolve(window.grecaptcha);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.onload = () => {
      const g = window.grecaptcha;
      if (!g) return reject(new Error("recaptcha"));
      g.ready(() => resolve(g));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error("recaptcha"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export async function getRecaptchaToken(siteKey: string, action: string): Promise<string> {
  const g = await loadRecaptcha(siteKey);
  return g.execute(siteKey, { action });
}
