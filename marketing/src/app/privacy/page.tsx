import type { Metadata } from "next";
import Link from "next/link";

import { PageSection } from "@/components/Section";
import { brand } from "@/lib/props";

const privacySections = [
  {
    title: "Information we collect",
    body: "We collect account details such as name, email address, organization, billing contacts, and workspace configuration. We also collect content you choose to ingest into the service, operational logs, device and browser information, and usage events needed to run, secure, and improve the product.",
  },
  {
    title: "How we use information",
    body: "We use personal information to provide the service, authenticate users, process payments, support customer requests, maintain security, prevent abuse, analyze product performance, and communicate important account, legal, and service updates. We may also use de-identified and aggregated data to understand usage trends and improve the platform.",
  },
  {
    title: "Customer content and AI processing",
    body: "Customer content remains under the control of the customer that submits it. We process source material, metadata, and derived outputs only as needed to provide ranking, summarization, extraction, search, and related product features. Where third-party infrastructure or model providers are used, they act as service providers or subprocessors under appropriate contractual controls.",
  },
  {
    title: "Sharing and disclosure",
    body: "We do not sell personal information. We share information only with service providers that help us operate the platform, with payment processors, with analytics or infrastructure vendors acting on our behalf, when required by law, or as part of a merger, financing, or acquisition. We may disclose information to protect the rights, security, or property of customers, users, or the public when legally permitted.",
  },
  {
    title: "Retention",
    body: "We retain personal information for as long as needed to provide the service, comply with legal obligations, resolve disputes, and enforce agreements. Customers can request deletion of workspace content, and we will remove or anonymize information according to contractual commitments, backup schedules, and legal requirements.",
  },
  {
    title: "Security",
    body: "We use administrative, technical, and physical safeguards designed to protect information against unauthorized access, loss, misuse, or alteration. No method of transmission or storage is completely secure, so we cannot guarantee absolute security, but we design our systems and operational practices to reduce risk and limit access.",
  },
  {
    title: "International transfers",
    body: "If information is transferred across borders, we use appropriate safeguards such as contractual protections and vendor commitments designed to support lawful data transfers. Customers are responsible for configuring the service in ways that match their own regulatory and contractual obligations.",
  },
  {
    title: "Your choices and rights",
    body: "Depending on your location, you may have rights to access, correct, delete, restrict, or export personal information, or to object to certain processing. You may also update profile information within the product or contact us to submit a request. We may need to verify identity before completing certain requests.",
  },
  {
    title: "Changes to this policy",
    body: "We may update this Privacy Policy from time to time to reflect product, legal, or operational changes. When we do, we will post the updated version on this page and revise the effective date. Material changes may also be communicated through the product or by email where appropriate.",
  },
];

export const metadata: Metadata = {
  title: `${brand.name} Privacy Policy`,
  description: "How Digest Engine collects, uses, protects, and processes personal information in connection with the service.",
};

export default function PrivacyPage() {
  return (
    <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 pt-24 md:gap-6">
      <PageSection id="privacy-hero" classes="px-6 py-10 sm:px-10 sm:py-12">
        <div className="max-w-4xl space-y-5">
          <span className="inline-flex w-fit items-center rounded-full border border-trim-offset bg-page-base px-4 py-2 text-sm font-medium text-content-offset shadow-soft backdrop-blur-[18px]">
            Privacy Policy
          </span>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-primary sm:text-5xl lg:text-6xl">
            Privacy terms for using {brand.name}
          </h1>

          <p className="max-w-3xl text-lg leading-8 text-content-active">
            This page describes the standard ways a SaaS product like {brand.name} collects,
            uses, stores, and protects personal information in connection with accounts,
            billing, support, and product usage.
          </p>

          <p className="text-sm text-content-offset">Effective date: May 16, 2026</p>
        </div>
      </PageSection>

      <PageSection id="privacy-summary" classes="px-6 py-8 sm:px-8 sm:py-10">
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            "We use information to operate, secure, support, and improve the service.",
            "We do not sell personal information.",
            "Customers control the content they choose to process through the platform.",
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

      <PageSection id="privacy-policy" classes="px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
            Policy details
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
            Standard privacy terms for a SaaS workflow
          </h2>
          <p className="mt-3 text-base leading-7 text-content-offset">
            This copy is intentionally general and should be reviewed with counsel before you rely on it as final legal text.
          </p>
        </div>

        <div className="mt-8 grid gap-4">
          {privacySections.map((section) => (
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

      <PageSection id="privacy-contact" classes="px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-3xl rounded-4xl border border-trim-offset bg-page-base p-6 shadow-card sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
            Contact
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
            Questions about privacy or data handling?
          </h2>
          <p className="mt-3 text-base leading-7 text-content-offset">
            Contact the {brand.name} team through the signup page or your existing customer support channel for privacy-related questions, subprocessors, or deletion requests.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-base font-semibold text-primary-inverse no-underline transition-colors hover:bg-accent-offset"
            >
              Contact sales
            </Link>
            <Link
              href="/docs/reference/overview"
              className="inline-flex items-center justify-center rounded-full border border-trim-offset px-5 py-3 text-base font-semibold text-content-active no-underline transition-colors hover:text-content-offset"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </PageSection>
    </main>
  );
}
