import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, LockKeyhole, ServerCrash, ShieldCheck } from "lucide-react";

import { PageSection } from "@/components/Section";
import { brand } from "@/lib/props";

const securityHighlights = [
  {
    title: "Encryption standards",
    description:
      "Document the transport and storage protections you actually use, such as TLS for data in transit, encryption at rest, key-management practices, and how secrets are handled.",
    icon: LockKeyhole,
  },
  {
    title: "Availability commitments",
    description:
      "Summarize uptime targets, backup practices, monitoring coverage, incident response expectations, and how customers are notified when service issues occur.",
    icon: ServerCrash,
  },
  {
    title: "Privacy program",
    description:
      "Explain how the service supports buyer review for GDPR, CCPA, data minimization, data processing terms, and customer-controlled deletion or export workflows.",
    icon: ShieldCheck,
  },
  {
    title: "Assurance artifacts",
    description:
      "List the reports, questionnaires, subprocessors, security summaries, or audit artifacts you can share during procurement or vendor review.",
    icon: BadgeCheck,
  },
];

const frameworkStatuses = [
  {
    name: "SOC 2",
    status: "Replace with verified status",
    detail:
      "Update this card with your real scope, report type, audit period, or readiness status before external publication.",
  },
  {
    name: "ISO 27001",
    status: "Replace with verified status",
    detail:
      "Use this area to disclose whether certification exists, is in progress, or is not currently part of the program.",
  },
  {
    name: "HIPAA",
    status: "Replace with verified status",
    detail:
      "State clearly whether HIPAA support is available, limited to specific deployment models, or not offered at all.",
  },
  {
    name: "GDPR",
    status: "Replace with verified status",
    detail:
      "Summarize lawful-processing support, DPA availability, regional transfer safeguards, and deletion or access request workflows.",
  },
  {
    name: "CCPA",
    status: "Replace with verified status",
    detail:
      "Describe your service-provider posture, disclosure practices, and how business customers can support consumer requests where applicable.",
  },
];

const buyerReviewSections = [
  {
    title: "Security architecture",
    body: "Use this section to summarize environment separation, access controls, least-privilege practices, audit logging, vulnerability management, and internal review processes. Buyers typically want a concise explanation of how the service is secured, not just a list of vendor names.",
  },
  {
    title: "Operational reliability",
    body: "Document uptime objectives, incident escalation paths, disaster recovery planning, and how service interruptions are communicated. If you publish a status page, support response targets, or backup windows, link or summarize them here.",
  },
  {
    title: "Data governance",
    body: "Describe what customer data is processed, where it is stored, who can access it, how long it is retained, and how deletion or export requests are handled. This is also the right place to summarize subprocessor governance and contractual security commitments.",
  },
  {
    title: "Procurement support",
    body: "Many B2B buyers need more than a marketing claim. Call out whether you can provide NDAs, security questionnaires, DPAs, architecture overviews, incident-response summaries, or compliance reports during vendor review.",
  },
];

export const metadata: Metadata = {
  title: `${brand.name} Compliance`,
  description: `A trust-center style overview of security, privacy, uptime, and compliance review information for ${brand.name}.`,
};

export default function CompliancePage() {
  return (
    <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 pt-24 md:gap-6">
      <PageSection id="compliance-hero" classes="px-6 py-10 sm:px-10 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
          <div className="max-w-3xl space-y-5">
            <span className="inline-flex w-fit items-center rounded-full border border-trim-offset bg-page-base px-4 py-2 text-sm font-medium text-content-offset shadow-soft backdrop-blur-[18px]">
              Trust Center
            </span>

            <h1 className="text-4xl font-semibold tracking-tight text-primary sm:text-5xl lg:text-6xl">
              Security and compliance information for buyer review
            </h1>

            <p className="text-lg leading-8 text-content-active">
              This page is designed as a trust-center style overview for B2B buyers evaluating {brand.name}. It covers the control areas procurement teams usually ask about: encryption, uptime, privacy compliance, and framework readiness.
            </p>

            <p className="text-base leading-7 text-content-offset">
              The framework badges below are intentionally written as placeholders. Replace each one with your verified status before treating this page as a public source of record.
            </p>
          </div>

          <div className="rounded-4xl border border-trim-offset bg-page-base p-6 shadow-card backdrop-blur-[18px]">
            <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
              Buyer checklist
            </p>
            <div className="mt-5 space-y-4">
              {[
                "Describe encryption in transit and at rest.",
                "State uptime goals and incident communication expectations.",
                "Clarify GDPR and CCPA support for business customers.",
                "Publish only certifications or attestations you can verify.",
              ].map((item) => (
                <div key={item} className="rounded-3xl border border-trim-offset bg-background p-4">
                  <p className="text-base font-semibold tracking-tight text-content-active">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageSection>

      <PageSection id="compliance-highlights" classes="px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
            Core topics
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
            The trust signals most SaaS buyers check first
          </h2>
          <p className="mt-3 text-base leading-7 text-content-offset">
            A strong trust center is specific, current, and easy for procurement teams to scan.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {securityHighlights.map((highlight) => {
            const Icon = highlight.icon;

            return (
              <article
                key={highlight.title}
                className="rounded-3xl border border-trim-offset bg-page-base p-6 shadow-card"
              >
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-background text-content-active">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-xl font-semibold tracking-tight text-content-active">
                  {highlight.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-content-offset">
                  {highlight.description}
                </p>
              </article>
            );
          })}
        </div>
      </PageSection>

      <PageSection id="compliance-frameworks" classes="px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
            Frameworks
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
            Compliance badges and certifications buyers look for
          </h2>
          <p className="mt-3 text-base leading-7 text-content-offset">
            Use these cards to show the real status of your program. Avoid implying certification, attestation, or regulatory coverage unless it is true and current.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-5">
          {frameworkStatuses.map((framework) => (
            <article
              key={framework.name}
              className="rounded-3xl border border-trim-offset bg-page-base p-5 shadow-card"
            >
              <p className="text-sm font-semibold uppercase tracking-widest text-content-offset">
                {framework.name}
              </p>
              <p className="mt-3 inline-flex rounded-full border border-trim-offset bg-background px-3 py-1 text-sm font-semibold text-content-active">
                {framework.status}
              </p>
              <p className="mt-4 text-sm leading-6 text-content-offset">{framework.detail}</p>
            </article>
          ))}
        </div>
      </PageSection>

      <PageSection id="compliance-details" classes="px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
            Review details
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
            What a procurement or security review should learn here
          </h2>
          <p className="mt-3 text-base leading-7 text-content-offset">
            The point of a trust center is to shorten diligence cycles with concrete, buyer-relevant information.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {buyerReviewSections.map((section) => (
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

      <PageSection id="compliance-contact" classes="px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-3xl rounded-4xl border border-trim-offset bg-page-base p-6 shadow-card sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
            Contact
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
            Need security answers for procurement?
          </h2>
          <p className="mt-3 text-base leading-7 text-content-offset">
            Contact the {brand.name} team if you need a security questionnaire, DPA discussion, architecture summary, or a buyer-ready version of this trust center with verified control details.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-base font-semibold text-primary-inverse no-underline transition-colors hover:bg-accent-offset"
            >
              Contact sales
            </Link>
            <Link
              href="/privacy"
              className="inline-flex items-center justify-center rounded-full border border-trim-offset px-5 py-3 text-base font-semibold text-content-active no-underline transition-colors hover:text-content-offset"
            >
              View privacy policy
            </Link>
          </div>
        </div>
      </PageSection>
    </main>
  );
}
