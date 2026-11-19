"use client";

import { useState } from "react";
import { validateEmail } from "@/components/layout/NewsletterForm";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

/** Click → 2 s loading → back. Shows that the width holds and repeat clicks are ignored. */
export function LoadingButtonDemo() {
  const [loading, setLoading] = useState(false);
  const [clicks, setClicks] = useState(0);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button
        loading={loading}
        loadingLabel="Saving"
        onClick={() => {
          setClicks((c) => c + 1);
          setLoading(true);
          window.setTimeout(() => setLoading(false), 2000);
        }}
      >
        Save changes
      </Button>
      <p className="text-ui text-ink-muted" aria-live="polite">
        Accepted clicks: <span className="tabular-nums">{clicks}</span>
      </p>
    </div>
  );
}

/** Validation on blur: type a bad address, then tab away. */
export function BlurValidationDemo() {
  return (
    <TextField
      label="Guardian email"
      name="demo-email"
      type="email"
      inputMode="email"
      autoComplete="off"
      spellCheck={false}
      hint="We send class times and receipts here."
      validate={validateEmail}
    />
  );
}
