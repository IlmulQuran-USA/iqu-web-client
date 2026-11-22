import { RevealItem } from "@/components/motion/Reveal";
import { schedule } from "@/content/home";
import { LocalTime } from "./LocalTime";

/**
 * Home §2 · The scheduling answer (spec §7.1). Three facts in a hairline-ruled
 * row, then the visitor's own local time and an invitation to pick any time
 * (owner, 20 Nov 2026: times are fully flexible, no teaching-hours window).
 * No pickers that do nothing, and no claim that anyone is teaching right now.
 */
export function ScheduleSection() {
  return (
    <section aria-labelledby="schedule-title" className="container-content">
      <div className="border-t border-rule py-12 md:py-16 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-4">
            <h2 id="schedule-title" className="text-heading-xl text-balance md:text-display-md">
              {schedule.heading}
            </h2>
            <div className="mt-6">
              <LocalTime />
            </div>
          </div>
          <ul className="grid gap-8 sm:grid-cols-3 sm:gap-6 lg:col-span-8">
            {schedule.points.map((point) => (
              <RevealItem as="li" key={point.title} className="border-t border-ink pt-5">
                <h3 className="font-display text-heading-md font-semibold text-ink">{point.title}</h3>
                <p className="mt-2 text-body text-pretty text-ink-body">{point.body}</p>
              </RevealItem>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
