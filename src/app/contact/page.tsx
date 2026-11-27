import { Globe, Mail, MapPin, MessageCircle, Phone, type LucideIcon } from "lucide-react";
import { ContactForm } from "@/components/contact/ContactForm";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { CopyButton } from "@/components/ui/CopyButton";
import { TextLink } from "@/components/ui/TextLink";
import { channels, contactFaq, contactForm, contactHeader, contactMeta, type Channel } from "@/content/contact";
import { pageMetadata } from "@/lib/metadata";
import { contactConfig } from "@/lib/server/contact";

/*
 * Contact — /contact (spec §7.15; plan approved by the owner, answers 1–4
 * yes; the form sends through the Gmail API mailer, Resolved facts 24 Nov 2026).
 * A ledger of real channels (call or text with a copy button, email,
 * WhatsApp, the office with directions, Facebook) beside a message form. The
 * live text hours are not shown until their time zone is confirmed. Without
 * the mailer, the database or the hash secret, the form is replaced by
 * "Message form opens soon." (src/lib/server/contact.ts). No map iframe (spec:
 * it costs Core Web Vitals); "Get directions" links out instead.
 */

export const metadata = pageMetadata({ title: contactMeta.title, description: contactMeta.description, path: "/contact" });

const ICONS: Record<Channel["id"], LucideIcon> = { phone: Phone, email: Mail, whatsapp: MessageCircle, address: MapPin, facebook: Globe };

function ChannelRow({ channel }: { channel: Channel }) {
  const Icon = ICONS[channel.id];
  const external = channel.external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 border-b border-rule py-5">
      <Icon aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-5 text-accent-strong" />
      <div className="min-w-0">
        <dt className="text-ui text-ink-muted">{channel.label}</dt>
        <dd className="mt-1 text-body-lg font-medium break-words text-ink">
          {channel.id === "address" ? (
            <span translate="no">{channel.value}</span>
          ) : (
            <a
              href={channel.href}
              {...external}
              className="inline-flex min-h-11 items-center underline decoration-ink-muted decoration-1 underline-offset-4 transition-[text-decoration-color] duration-(--duration-micro) hov:decoration-ink"
            >
              {channel.value}
              {channel.external ? <span className="sr-only"> (opens in a new tab)</span> : null}
            </a>
          )}
        </dd>
        {/* A second <dd> only where there is something in it: the copy button or the directions link. */}
        {channel.copy || channel.action ? (
          <dd className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
            {channel.copy ? <CopyButton value={channel.value} label={`phone number ${channel.value}`} /> : null}
            {channel.action ? (
              <a href={channel.href} {...external} className="inline-flex min-h-11 items-center text-body text-link underline underline-offset-2">
                {channel.action}
                <span className="sr-only"> (opens Google Maps in a new tab)</span>
              </a>
            ) : null}
          </dd>
        ) : null}
      </div>
    </div>
  );
}

export default function ContactPage() {
  const open = contactConfig() !== null;
  return (
    <>
      <Header />
      <main id="main-content" className="container-content flex-1 pb-16 md:pb-24">
        <div className="pt-2 pb-8 md:pb-12">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: contactHeader.title }]} />
          <h1 className="mt-4 text-display-md font-medium md:text-display-lg">{contactHeader.title}</h1>
          <p className="mt-4 max-w-measure text-body-lg text-pretty text-ink-body md:mt-6">{contactHeader.intro}</p>
        </div>

        <div className="grid gap-12 lg:grid-cols-12 lg:gap-6">
          <section aria-labelledby="channels-title" className="lg:col-span-5">
            <h2 id="channels-title" className="text-heading-xl">
              Reach us directly
            </h2>
            <dl className="mt-6 border-t border-ink">
              {channels.map((c) => (
                <ChannelRow key={c.id} channel={c} />
              ))}
            </dl>
          </section>

          <section aria-labelledby="message-title" className="lg:col-span-6 lg:col-start-7">
            <h2 id="message-title" className="text-heading-xl">
              {contactForm.heading}
            </h2>
            {open ? <p className="mt-2 text-body text-ink-body">{contactForm.intro}</p> : null}
            {/* Spec §7.15 item 5: the FAQ link sits above the form, in both form states. */}
            <p className="mt-3 text-body text-pretty text-ink-body">{contactFaq.text}</p>
            <TextLink label={contactFaq.link.label} href={contactFaq.link.href} />
            {open ? (
              <div className="mt-6">
                <ContactForm />
              </div>
            ) : (
              <div className="mt-6 rounded-card bg-surface p-6 sm:p-8">
                <p className="text-body-lg font-medium text-ink">{contactForm.closed}</p>
                <p className="mt-2 text-body text-ink-body">{contactForm.closedHelp}</p>
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
