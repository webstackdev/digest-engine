import type { Metadata } from "next";
import Link from "next/link";

import { PageSection } from "@/components/Section";
import { Button } from "@/components/shared/button";
import { brand } from "@/lib/props";

import SignupForm from "./_components/SignupForm";

const signupHighlights = [
  "Project-scoped ranking from day one",
  "Support for RSS, social, and newsletter sources",
  "A faster path from shortlist to draft",
];

const signupNextSteps = [
  "We review your workflow and source mix.",
  "We point you to the right plan or setup path.",
  "You start with one project and one issue cycle.",
];

export const metadata: Metadata = {
  title: `${brand.name} Sign Up`,
  description: "Request access to Digest Engine and tell us how your editorial workflow works today.",
};

export default function SignupPage() {
  return (
    <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 pt-24 md:gap-6">
      <PageSection id="signup-hero" classes="px-6 py-10 sm:px-10 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
          <div className="flex flex-col gap-6">
            <span className="w-fit rounded-full border border-trim-offset bg-page-base px-4 py-2 text-sm font-medium text-content-offset shadow-soft backdrop-blur-[18px]">
              Sign up
            </span>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-primary sm:text-5xl lg:text-6xl">
                Start with a workflow that learns your editorial taste
              </h1>

              <p className="max-w-2xl text-lg leading-8 text-content-active">
                Digest Engine is designed for editors who want better sourcing, stronger prioritization, and less blank-page friction. Fill out the form and we will help you start with the right setup.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 rounded-full px-6 text-lg font-semibold"
              >
                <Link href="/pricing">Compare plans</Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 rounded-full px-6 text-lg font-semibold"
              >
                <Link href="/docs/reference/overview">Read the docs</Link>
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {signupHighlights.map((highlight) => (
                <div
                  key={highlight}
                  className="rounded-3xl border border-trim-offset bg-page-base p-5 shadow-card backdrop-blur-[18px]"
                >
                  <p className="text-base font-semibold tracking-tight text-content-active">
                    {highlight}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <SignupForm />
        </div>
      </PageSection>

      <PageSection id="signup-next-steps" classes="px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
            What happens next
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
            A typical rollout starts small and gets useful quickly
          </h2>
          <p className="mt-3 text-base leading-7 text-content-offset">
            Most teams begin with one editorial workflow, one source mix, and one issue cycle. That is enough to see whether the ranking and review loop fit your process.
          </p>
        </div>

        <ol className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Signup next steps">
          {signupNextSteps.map((step, index) => (
            <li
              key={step}
              className="rounded-3xl border border-trim-offset bg-page-base p-6 shadow-card"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-content-offset">
                Step 0{index + 1}
              </p>
              <p className="mt-4 text-base font-semibold tracking-tight text-content-active">
                {step}
              </p>
            </li>
          ))}
        </ol>
      </PageSection>
    </main>
  );
}