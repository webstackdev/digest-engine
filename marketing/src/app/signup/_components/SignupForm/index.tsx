"use client";

import ClaritySDK from "@microsoft/clarity";
import { useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/shared/button";
import {
  readMarketingAttribution,
  type MarketingAttribution,
} from "@/lib/marketingAttribution";
import {
  buildSignupSubmissionPayload,
  buildSignupSubmittedDataLayerEvent,
  getSignupHiddenAttributionFields,
  type SignupDataLayerEvent,
  type SignupFormValues,
} from "@/lib/marketingConversion";
import { readConsentPreferences } from "@/lib/marketingConsent";

function subscribeToStaticSnapshot() {
  return () => {};
}

function pushSignupSubmittedDataLayerEvent(event: SignupDataLayerEvent) {
  const dataLayerWindow = window as Window & { dataLayer?: object[] };

  dataLayerWindow.dataLayer = dataLayerWindow.dataLayer ?? [];
  dataLayerWindow.dataLayer.push(event);
}

function trackSignupSubmitted(
  values: SignupFormValues,
  attribution: MarketingAttribution | null,
  pagePath: string,
) {
  if (!readConsentPreferences()?.marketing) {
    return;
  }

  const event = buildSignupSubmittedDataLayerEvent(values, attribution, pagePath);

  ClaritySDK.event("signup_request_submitted");
  ClaritySDK.identify(values.workEmail, undefined, "marketing-signup");
  ClaritySDK.setTag("signup_form", "marketing");
  ClaritySDK.setTag("signup_plan_interest", values.planInterest);
  ClaritySDK.setTag("signup_team_size", values.teamSize);
  ClaritySDK.setTag("signup_attribution_source", event.attribution_source);
  ClaritySDK.setTag("signup_attribution_medium", event.attribution_medium);

  if (event.attribution_campaign) {
    ClaritySDK.setTag("signup_attribution_campaign", event.attribution_campaign);
  }

  if (event.attribution_referrer_host) {
    ClaritySDK.setTag("signup_referrer_host", event.attribution_referrer_host);
  }

  if (event.gclid) {
    ClaritySDK.setTag("signup_gclid", event.gclid);
  }

  if (event.fbclid) {
    ClaritySDK.setTag("signup_fbclid", event.fbclid);
  }

  if (event.msclkid) {
    ClaritySDK.setTag("signup_msclkid", event.msclkid);
  }

  pushSignupSubmittedDataLayerEvent(event);
}

/**
 * Route-local signup form for the marketing signup page.
 */
export default function SignupForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    defaultValues: {
      fullName: "",
      workEmail: "",
      newsletterName: "",
      planInterest: "team",
      teamSize: "1-3",
      notes: "",
    },
  });

  const isClient = useSyncExternalStore(
    subscribeToStaticSnapshot,
    () => true,
    () => false,
  );
  const attribution: MarketingAttribution | null = isClient ? readMarketingAttribution() : null;
  const pagePath = isClient ? window.location.pathname : "";

  const onSubmit = async (values: SignupFormValues) => {
    setIsSubmitted(false);
    const currentAttribution = readMarketingAttribution();
    const currentPagePath = window.location.pathname;
    const submissionPayload = buildSignupSubmissionPayload(values, currentAttribution, currentPagePath);

    await Promise.resolve(submissionPayload);
    trackSignupSubmitted(values, currentAttribution, currentPagePath);
    reset();
    setIsSubmitted(true);
  };

  const hiddenAttributionFields = getSignupHiddenAttributionFields(attribution, pagePath);

  return (
    <div className="rounded-4xl border border-trim-offset bg-page-base p-6 shadow-panel backdrop-blur-[18px] sm:p-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-content-active sm:text-3xl">
          Start your first Digest Engine project
        </h2>
        <p className="text-base leading-7 text-content-offset">
          Tell us a bit about your newsletter and workflow. We will use this to point you to the right setup path.
        </p>
      </div>

      <form id="signup-form" className="mt-8 grid gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        {hiddenAttributionFields.map((field) => (
          <input key={field.name} type="hidden" name={field.name} value={field.value} readOnly />
        ))}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-content-active">
            Full name
            <input
              type="text"
              autoComplete="name"
              className="h-12 rounded-2xl border border-trim-offset bg-page-offset px-4 text-base text-content-active"
              {...register("fullName", { required: "Enter your name." })}
            />
            {errors.fullName ? <span role="alert" className="text-sm text-danger">{errors.fullName.message}</span> : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-content-active">
            Work email
            <input
              type="email"
              autoComplete="email"
              className="h-12 rounded-2xl border border-trim-offset bg-page-offset px-4 text-base text-content-active"
              {...register("workEmail", {
                required: "Enter your email.",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Enter a valid email address.",
                },
              })}
            />
            {errors.workEmail ? <span role="alert" className="text-sm text-danger">{errors.workEmail.message}</span> : null}
          </label>
        </div>

        <label className="grid gap-2 text-sm font-medium text-content-active">
          Newsletter or publication name
          <input
            type="text"
            className="h-12 rounded-2xl border border-trim-offset bg-page-offset px-4 text-base text-content-active"
            {...register("newsletterName", {
              required: "Tell us what you publish.",
            })}
          />
          {errors.newsletterName ? <span role="alert" className="text-sm text-danger">{errors.newsletterName.message}</span> : null}
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-content-active">
            Plan interest
            <select
              className="h-12 rounded-2xl border border-trim-offset bg-page-offset px-4 text-base text-content-active"
              {...register("planInterest")}
            >
              <option value="open-source">Open Source</option>
              <option value="team">Team</option>
              <option value="hosted">Hosted</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-content-active">
            Team size
            <select
              className="h-12 rounded-2xl border border-trim-offset bg-page-offset px-4 text-base text-content-active"
              {...register("teamSize")}
            >
              <option value="1-3">1-3 people</option>
              <option value="4-10">4-10 people</option>
              <option value="11-25">11-25 people</option>
              <option value="26+">26+ people</option>
            </select>
          </label>
        </div>

        <label className="grid gap-2 text-sm font-medium text-content-active">
          What are you trying to improve?
          <textarea
            rows={5}
            className="rounded-3xl border border-trim-offset bg-page-offset px-4 py-3 text-base text-content-active"
            placeholder="Examples: better source coverage, faster issue planning, more useful summaries, fewer duplicate stories"
            {...register("notes")}
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-content-offset">
            No credit card required. We will follow up with the best next step for your workflow.
          </p>
          <Button
            type="submit"
            className="h-12 rounded-full bg-accent px-7 text-base font-semibold text-primary-inverse transition-colors hover:bg-accent-offset"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending..." : "Request access"}
          </Button>
        </div>

        {isSubmitted ? (
          <p role="status" className="rounded-2xl border border-trim-offset bg-page-offset px-4 py-3 text-sm text-content-active">
            Thanks. Your signup request is in and we will follow up with the best starting path.
          </p>
        ) : null}
      </form>
    </div>
  );
}
