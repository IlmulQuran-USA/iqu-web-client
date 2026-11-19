"use client";

import { CircleAlert } from "lucide-react";
import {
  useId,
  useState,
  type ComponentPropsWithoutRef,
  type FocusEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

/**
 * TextField: spec §6.3 (Form) and §9.1.
 *
 * - The label is always visible and never replaced by a placeholder.
 * - Validation runs on blur, never on keystroke. An error stays until the
 *   next blur re-checks the value.
 * - The error sits beside the field, is announced through an aria-live
 *   region and linked with aria-describedby. Colour is never the only signal:
 *   there is always an icon and text.
 * - Field text is 16 px, so iOS does not zoom when the field takes focus.
 * - A disabled field is a muted input. A system-supplied value is not a
 *   disabled field; it renders as ReadOnlyFact (spec §7C.3).
 */

export type TextFieldProps = Omit<ComponentPropsWithoutRef<"input">, "id" | "size"> & {
  label: string;
  name: string;
  /** Help text under the label, e.g. format or why we ask. */
  hint?: ReactNode;
  /** Marks the field "(optional)". Required fields carry no marker; most fields are required. */
  optional?: boolean;
  /**
   * An error from the server or the form (e.g. after submit). It shows until
   * the person corrects the value and leaves the field; a failing `validate`
   * result takes its place.
   */
  error?: string;
  /** Runs on blur. Return a message to show an error, or undefined when valid. */
  validate?: (value: string) => string | undefined;
  /** Use the field's name as its anchor id, so an error summary can link to it. */
  id?: string;
};

export function TextField({
  label,
  name,
  hint,
  optional = false,
  error,
  validate,
  id,
  className,
  onBlur,
  disabled,
  required,
  ...inputProps
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? `${name}-${autoId}`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  const [blurError, setBlurError] = useState<string | undefined>(undefined);

  // A server error is dismissed once the person changes the value and leaves
  // the field with it passing `validate`. Forms pass the submitted value back
  // as defaultValue, so "changed" means different from what the server judged.
  // A new error from the server shows again.
  const [serverError, setServerError] = useState({ message: error, dismissed: false });
  if (serverError.message !== error) {
    setServerError({ message: error, dismissed: false });
  }

  const visibleServerError = error && !serverError.dismissed ? error : undefined;
  const message = blurError ?? visibleServerError;
  const invalid = Boolean(message);

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const { value, defaultValue } = event.currentTarget;
    const result = validate?.(value);
    setBlurError(result);
    if (visibleServerError && !result && value !== defaultValue) {
      setServerError({ message: error, dismissed: true });
    }
    onBlur?.(event);
  }

  const describedBy = [hint ? hintId : null, invalid ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={inputId} className="text-ui font-medium text-ink">
        {label}
        {optional ? <span className="font-normal text-ink-muted"> (optional)</span> : null}
      </label>

      {hint ? (
        <p id={hintId} className="mt-1 max-w-measure text-ui text-ink-muted">
          {hint}
        </p>
      ) : null}

      <input
        {...inputProps}
        id={inputId}
        name={name}
        disabled={disabled}
        required={required ?? !optional}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy || undefined}
        onBlur={handleBlur}
        className={cn(
          "mt-2 min-h-12 w-full rounded-input bg-paper text-body text-ink",
          "transition-[border-color] duration-(--duration-micro) ease-riwaq",
          "placeholder:text-ink-muted",
          // The error border is 2 px, so an error differs from the hover and focus
          // states in weight as well as colour. Padding drops 1 px to match,
          // so the box doesn't move.
          invalid
            ? "border-2 border-danger px-2.75 py-2.25"
            : "border border-field-border px-3 py-2.5 hov:not-disabled:border-ink",
          "disabled:cursor-not-allowed disabled:border-rule disabled:bg-surface disabled:text-ink-muted",
        )}
      />

      {/* Always rendered so the live region exists before the first error. */}
      <div aria-live="polite">
        {invalid ? (
          <p id={errorId} className="mt-2 flex items-start gap-1.5 text-ui text-danger">
            <CircleAlert aria-hidden="true" strokeWidth={1.5} className="mt-px size-4 shrink-0" />
            <span>{message}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
