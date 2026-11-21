"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * The directory's course filter: a native select inside a GET form. With
 * JavaScript it navigates on change, keeping the language filter and the
 * scroll position; without it the form's Show button submits (noscript).
 * State lives in the URL (CLAUDE.md §7).
 */
export function CourseSelect({
  id,
  name,
  value,
  lang,
  anyLabel,
  options,
}: {
  id: string;
  name: string;
  value: string | null;
  /** The current language filter (lowercase), kept when the course changes. */
  lang: string | null;
  anyLabel: string;
  options: readonly { id: string; label: string }[];
}) {
  const router = useRouter();
  return (
    <div className="relative mt-2">
      <select
        id={id}
        name={name}
        defaultValue={value ?? ""}
        onChange={(event) => {
          const q = new URLSearchParams();
          if (event.currentTarget.value) q.set("course", event.currentTarget.value);
          if (lang) q.set("lang", lang);
          const s = q.toString();
          router.push(s ? `/instructors?${s}` : "/instructors", { scroll: false });
        }}
        className="min-h-11 w-full appearance-none rounded-input border border-field-border bg-paper py-2 pr-10 pl-3 text-body text-ink transition-[border-color] duration-(--duration-micro) ease-riwaq hov:border-ink sm:w-72"
      >
        <option value="">{anyLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        strokeWidth={1.5}
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-ink-muted sm:left-64 sm:right-auto"
      />
    </div>
  );
}
