import type { Metadata } from "next";
import Link from "next/link";

import { PageSection } from "@/components/Section";
import { brand } from "@/lib/props";

const termsSections = [
  {
    title: "Acceptance of these terms",
    body: `By accessing or using ${brand.name}, you agree to these Terms of Service on behalf of yourself or the organization you represent. If you are using the service for a company, newsroom, or other entity, you represent that you have authority to bind that entity to these terms.`,
  },
  {
    title: "The service",
    body: `${brand.name} is a software-as-a-service platform for source ingestion, ranking, review workflows, and related editorial or intelligence features. We may modify, improve, or discontinue parts of the service from time to time as the product evolves.`,
  },
  {
    title: "Accounts and access",
    body: "You are responsible for maintaining the confidentiality of account credentials, restricting unauthorized access, and ensuring that users in your workspace use the service in compliance with these terms. You must provide accurate account information and promptly update it if it changes.",
  },
  {
    title: "Subscriptions, fees, and billing",
    body: "Paid plans may be billed on a recurring basis under an order form, subscription agreement, or checkout flow. Unless otherwise agreed in writing, fees are non-refundable except where required by law. You are responsible for applicable taxes, and late or unpaid amounts may result in suspension or termination of service access.",
  },
  {
    title: "Customer content",
    body: "You retain ownership of the content, source materials, prompts, uploaded files, and workspace data you submit to the service. You grant us a limited right to host, process, transmit, copy, and display that content only as necessary to provide, secure, support, and improve the service in accordance with our agreements and Privacy Policy.",
  },
  {
    title: "Acceptable use",
    body: "You may not use the service to violate law, infringe intellectual property rights, bypass security controls, interfere with the platform, submit malicious code, misuse another user's account, or process content in a way that violates your contractual, regulatory, or employment obligations. We may suspend access to protect the service, customers, or third parties from harm.",
  },
  {
    title: "Third-party services",
    body: "The service may depend on third-party hosting, model providers, payment processors, analytics vendors, or integrations. We are not responsible for third-party services outside our control, and your use of those services may also be subject to their own terms and policies.",
  },
  {
    title: "Intellectual property",
    body: `We and our licensors retain all rights, title, and interest in ${brand.name}, including the software, documentation, branding, and all related intellectual property, except for the rights you retain in your own content. These terms do not grant you any ownership rights in the service itself.`,
  },
  {
    title: "Feedback",
    body: "If you provide suggestions, ideas, bug reports, or product feedback, you grant us a worldwide, royalty-free right to use that feedback for any lawful purpose without obligation to you, so long as doing so does not disclose your confidential information in a way that violates our commitments.",
  },
  {
    title: "Disclaimers",
    body: "Except as expressly provided in a written agreement, the service is provided on an as-is and as-available basis. To the maximum extent permitted by law, we disclaim implied warranties including merchantability, fitness for a particular purpose, non-infringement, and uninterrupted or error-free operation.",
  },
  {
    title: "Limitation of liability",
    body: "To the maximum extent permitted by law, neither party will be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, revenues, goodwill, data, or business opportunities. Our aggregate liability arising out of or related to the service will not exceed the amounts paid or payable by you for the service during the 12 months before the event giving rise to the claim, unless a different cap is set in a written agreement.",
  },
  {
    title: "Termination",
    body: "You may stop using the service at any time. We may suspend or terminate access for non-payment, material breach, misuse, legal risk, or where continued service would create security or compliance concerns. Upon termination, your right to use the service ends, though provisions that by their nature should survive will remain in effect.",
  },
  {
    title: "Changes to these terms",
    body: "We may update these Terms of Service from time to time. When we do, we will post the revised version on this page and update the effective date. If a change is material, we may also provide notice through the product, by email, or through another reasonable channel.",
  },
];

export const metadata: Metadata = {
  title: `${brand.name} Terms of Service`,
  description: `The standard terms that govern access to and use of ${brand.name}.`,
};

export default function TermsPage() {
  return (
    <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 pt-24 md:gap-6">
      <PageSection id="terms-hero" classes="px-6 py-10 sm:px-10 sm:py-12">
        <div className="max-w-4xl space-y-5">
          <span className="inline-flex w-fit items-center rounded-full border border-trim-offset bg-page-base px-4 py-2 text-sm font-medium text-content-offset shadow-soft backdrop-blur-[18px]">
            Terms of Service
          </span>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-primary sm:text-5xl lg:text-6xl">
            Standard terms for using {brand.name}
          </h1>

          <p className="max-w-3xl text-lg leading-8 text-content-active">
            These terms outline the typical contractual rules for access to a SaaS platform like {brand.name}, including account responsibilities, billing, content rights, acceptable use, disclaimers, and limitations of liability.
          </p>

          <p className="text-sm text-content-offset">Effective date: May 16, 2026</p>
        </div>
      </PageSection>

      <PageSection id="terms-summary" classes="px-6 py-8 sm:px-8 sm:py-10">
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            "You keep ownership of your content, and we only process it to operate the service.",
            "Paid access may be subject to recurring billing and plan-specific limits.",
            "This draft should be reviewed by counsel before being treated as final legal text.",
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

      <PageSection id="terms-policy" classes="px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
            Policy details
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
            Typical SaaS terms of service
          </h2>
          <p className="mt-3 text-base leading-7 text-content-offset">
            This copy is intentionally general and should be reviewed with counsel before you rely on it as final contract language.
          </p>
        </div>

        <div className="mt-8 grid gap-4">
          {termsSections.map((section) => (
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

      <PageSection id="terms-contact" classes="px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-3xl rounded-4xl border border-trim-offset bg-page-base p-6 shadow-card sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
            Contact
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
            Questions about contracts, plans, or legal terms?
          </h2>
          <p className="mt-3 text-base leading-7 text-content-offset">
            Contact the {brand.name} team through the signup page or your existing customer channel if you need an order form, enterprise terms, or clarifications about service usage.
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
