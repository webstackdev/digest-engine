import type { Metadata } from "next";
import Link from "next/link";

import { PageSection } from "@/components/Section";
import { brand } from "@/lib/props";

const cookieSections = [
  {
    title: "What cookies are",
    body: "Cookies are small text files stored on a browser or device when someone visits a website or uses an online service. Similar technologies can include pixels, local storage, tags, SDKs, and identifiers that help recognize a browser, remember settings, measure usage, or support product functionality.",
  },
  {
    title: "How we use cookies",
    body: `A SaaS product like ${brand.name} may use cookies and similar technologies to keep users signed in, remember preferences, maintain security, understand product usage, measure site performance, and support onboarding, support, and marketing operations.`,
  },
  {
    title: "Strictly necessary cookies",
    body: "These cookies are used to operate core site and product functions such as authentication, session continuity, security protections, load balancing, fraud prevention, and saving basic preferences. Because these cookies are required for the service to function, they are typically not subject to the same consent choices as optional cookies in some jurisdictions.",
  },
  {
    title: "Analytics cookies",
    body: "Analytics cookies help measure traffic, understand how visitors use pages and product flows, and identify areas that need improvement. They may collect information such as page views, navigation patterns, approximate geography, device attributes, and referral sources. Where required by law, these cookies should be enabled only after appropriate consent is obtained.",
  },
  {
    title: "Functional cookies",
    body: "Functional cookies remember choices such as language, theme, form progress, feature preferences, and other convenience settings so users do not have to re-enter them every time they return. These cookies improve usability but are not always strictly necessary to operate the service.",
  },
  {
    title: "Advertising and third-party cookies",
    body: "If the marketing site uses embedded content, campaign attribution, or advertising measurement tools, third parties may place cookies or receive information from them according to their own policies. These tools can help measure campaigns or personalize outreach, but they should be reviewed carefully and managed through consent controls where legally required.",
  },
  {
    title: "Managing cookie choices",
    body: "Users can usually manage cookies through browser settings, device controls, or site-level consent tools. Blocking some cookies may affect how parts of the site or product function. In jurisdictions that require consent for optional cookies, users should be able to accept, reject, or later update those preferences.",
  },
  {
    title: "Do Not Track and similar signals",
    body: "Some browsers provide privacy preference signals such as Do Not Track or other browser-based controls. Whether and how those signals are honored depends on the applicable law, technical implementation, and the specific tools in use. If your organization has stricter requirements, the service configuration should be reviewed accordingly.",
  },
  {
    title: "Changes to this policy",
    body: "We may update this Cookie Policy from time to time to reflect changes in technology, law, or product operations. When we do, we will post the updated version here and revise the effective date. Material changes may also be communicated through the site, product, or another reasonable notice channel.",
  },
];

export const metadata: Metadata = {
  title: `${brand.name} Cookie Policy`,
  description: `How ${brand.name} uses cookies and similar technologies on the marketing site and service.`,
};

export default function CookiesPage() {
  return (
    <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 pt-24 md:gap-6">
      <PageSection id="cookies-hero" classes="px-6 py-10 sm:px-10 sm:py-12">
        <div className="max-w-4xl space-y-5">
          <span className="inline-flex w-fit items-center rounded-full border border-trim-offset bg-page-base px-4 py-2 text-sm font-medium text-content-offset shadow-soft backdrop-blur-[18px]">
            Cookie Policy
          </span>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-primary sm:text-5xl lg:text-6xl">
            How {brand.name} uses cookies and similar technologies
          </h1>

          <p className="max-w-3xl text-lg leading-8 text-content-active">
            This page provides standard SaaS-style cookie policy copy describing how site and
            product experiences may use cookies for security, functionality, analytics, and
            optional marketing-related purposes.
          </p>

          <p className="text-sm text-content-offset">Effective date: May 16, 2026</p>
        </div>
      </PageSection>

      <PageSection id="cookies-summary" classes="px-6 py-8 sm:px-8 sm:py-10">
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            "Necessary cookies help the service stay secure and usable.",
            "Optional analytics and marketing cookies should follow local consent rules.",
            "Users can typically manage cookie settings through browsers or consent tools.",
          ].map((item) => (
            <div
              key={item}
              className="rounded-3xl border border-trim-offset bg-page-base p-6 shadow-card"
            >
              <p className="text-base font-semibold tracking-tight text-content-active">{item}</p>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection id="cookies-policy" classes="px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
            Policy details
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
            Typical cookie policy terms for a SaaS product
          </h2>
          <p className="mt-3 text-base leading-7 text-content-offset">
            This copy is intentionally general and should be reviewed with counsel before you rely on it as final legal or consent language.
          </p>
        </div>

        <div className="mt-8 grid gap-4">
          {cookieSections.map((section) => (
            <section
              key={section.title}
              aria-labelledby={section.title}
              className="rounded-3xl border border-trim-offset bg-page-base p-6 shadow-card"
            >
              <h3
                id={section.title}
                className="text-xl font-semibold tracking-tight text-content-active"
              >
                {section.title}
              </h3>
              <p className="mt-3 text-base leading-7 text-content-offset">{section.body}</p>
            </section>
          ))}
        </div>
      </PageSection>

      <PageSection id="cookies-contact" classes="px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-3xl rounded-4xl border border-trim-offset bg-page-base p-6 shadow-card sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
            Contact
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
            Questions about consent, tracking, or cookie settings?
          </h2>
          <p className="mt-3 text-base leading-7 text-content-offset">
            Contact the {brand.name} team through the signup page or your existing customer channel if you need more detail about cookies, consent handling, or third-party tools used with the service.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/privacy"
              className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-base font-semibold text-primary-inverse no-underline transition-colors hover:bg-accent-offset"
            >
              View privacy policy
            </Link>
            <Link
              href="/terms"
              className="inline-flex items-center justify-center rounded-full border border-trim-offset px-5 py-3 text-base font-semibold text-content-active no-underline transition-colors hover:text-content-offset"
            >
              View terms
            </Link>
          </div>
        </div>
      </PageSection>
    </main>
  );
}
