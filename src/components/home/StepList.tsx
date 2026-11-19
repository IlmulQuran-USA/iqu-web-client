import { howItWorks } from "@/content/home";

/**
 * StepList (spec §6.3) · Home §4 How it works. Four numbered steps joined by
 * one hairline: horizontal from lg, a vertical timeline below (all four
 * steps on phones). The numbers carry the sequence, so they are earned.
 */
export function StepList() {
  return (
    <section aria-labelledby="how-title" className="container-content">
      <div className="border-t border-rule py-12 md:py-16 lg:py-24">
        <h2 id="how-title" className="text-heading-xl md:text-display-md">
          {howItWorks.heading}
        </h2>
        <ol
          className={
            "relative mt-10 grid gap-10 lg:mt-12 lg:grid-cols-4 lg:gap-6 " +
            // The connecting hairline: vertical below lg, horizontal from lg.
            "before:absolute before:top-5 before:bottom-5 before:left-5 before:w-px before:bg-rule " +
            "lg:before:top-5 lg:before:right-0 lg:before:bottom-auto lg:before:left-0 lg:before:h-px lg:before:w-auto"
          }
        >
          {howItWorks.steps.map((step, i) => (
            <li key={step.title} className="relative pl-16 lg:pl-0">
              <span
                aria-hidden="true"
                className="absolute top-0 left-0 flex size-10 items-center justify-center rounded-pill border border-ink-body bg-paper font-display text-heading-md font-semibold text-ink tabular-nums lg:static"
              >
                {i + 1}
              </span>
              <h3 className="font-display text-heading-md font-semibold text-ink lg:mt-6">
                <span className="sr-only">Step {i + 1}: </span>
                {step.title}
              </h3>
              <p className="mt-2 max-w-measure text-body text-pretty text-ink-body">{step.body}</p>
              {"example" in step ? (
                <p className="mt-2 max-w-measure text-ui text-pretty text-ink-muted">{step.example}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
