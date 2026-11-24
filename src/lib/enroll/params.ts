/*
 * /enroll query parameters (enroll-architecture.md §4.2):
 *   ?course=<course id>              a monthly course, preselected
 *   ?program=weekend-ilm-program     the Weekend template
 *   ?program=summer-ilm-camp         the Summer template
 *   ?aid=request                     open the fee step on "I need help with the fee"
 * Unknown values are ignored: the step simply starts empty. Nothing from the
 * URL is ever passed to WordPress as is.
 */

import { monthlyCourses, programs, type CourseId } from "../../content/pricing.ts";

export type Variant = "monthly" | "weekend" | "summer";

export type EnrollParams = { variant: Variant; courseId: CourseId | null; aid: boolean };

type Raw = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseEnrollParams(raw: Raw): EnrollParams {
  const program = first(raw.program);
  const course = first(raw.course);
  const aid = first(raw.aid) === "request";
  if (program === programs.weekend.id) return { variant: "weekend", courseId: null, aid: false };
  if (program === programs.summer.id) return { variant: "summer", courseId: null, aid };
  const known = monthlyCourses.find((c) => c.id === course);
  return { variant: "monthly", courseId: known ? known.id : null, aid };
}

/** The live WordPress form for each template (the "not connected" fallback link). */
export const LIVE_FORM_URL: Record<Variant, string> = {
  monthly: "https://ilmulquranus.org/enroll-for-free/",
  weekend: "https://ilmulquranus.org/weekend-program/",
  summer: "https://ilmulquranus.org/summer-program/",
};
