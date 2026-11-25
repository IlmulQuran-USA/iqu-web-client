"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "./Button";

const noop = () => () => {};
const canCopy = () => typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";

/**
 * Copies a value (a phone number, a reference) and says so: the label turns
 * to "Copied" for 2.5 s and a polite live region announces it. The button is
 * rendered only where the Clipboard API exists (not on the server, an old
 * browser or an insecure origin), so it never shows and does nothing. If the
 * copy is refused, it says to select the value instead, which stays on the
 * page beside it.
 */
export function CopyButton({ value, label, copiedLabel = "Copied", className }: { value: string; label: string; copiedLabel?: string; className?: string }) {
  const available = useSyncExternalStore(noop, canCopy, () => false);
  const [result, setResult] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setResult("copied");
      timer.current = window.setTimeout(() => setResult("idle"), 2500);
    } catch {
      setResult("failed");
    }
  }

  if (!available) return null;
  const copied = result === "copied";
  return (
    <>
      <Button
        variant="secondary"
        onClick={copy}
        className={className}
        iconStart={copied ? <Check aria-hidden="true" strokeWidth={1.5} className="size-4" /> : <Copy aria-hidden="true" strokeWidth={1.5} className="size-4" />}
      >
        {copied ? copiedLabel : "Copy"}
        <span className="sr-only"> {label}</span>
      </Button>
      <span aria-live="polite" className={result === "failed" ? "text-ui text-ink-muted" : "sr-only"}>
        {copied ? `${label} copied` : result === "failed" ? "Copying didn’t work here. Select the text and copy it." : ""}
      </span>
    </>
  );
}
