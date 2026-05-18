import {
  getMarketingAttributionSummary,
  type MarketingAttribution,
} from "./marketingAttribution";

export type SignupFormValues = {
  fullName: string;
  workEmail: string;
  newsletterName: string;
  planInterest: string;
  teamSize: string;
  notes: string;
};

export type MarketingConversionContext = {
  attribution_campaign?: string;
  attribution_landing_path?: string;
  attribution_medium: string;
  attribution_referrer?: string;
  attribution_referrer_host?: string;
  attribution_source: string;
  fbclid?: string;
  gclid?: string;
  msclkid?: string;
  page_path: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_medium?: string;
  utm_source?: string;
  utm_term?: string;
};

export type SignupDataLayerEvent = MarketingConversionContext & {
  conversion_name: "signup_request_submitted";
  conversion_surface: "signup_form";
  event: "marketing_conversion";
  form_name: "marketing_signup";
  signup_plan_interest: string;
  signup_team_size: string;
};

export type SignupSubmissionPayload = MarketingConversionContext & {
  full_name: string;
  newsletter_name: string;
  notes: string;
  plan_interest: string;
  team_size: string;
  work_email: string;
};

export type HiddenSignupField = {
  name: keyof MarketingConversionContext;
  value: string;
};

const HIDDEN_SIGNUP_FIELD_NAMES = [
  "page_path",
  "attribution_source",
  "attribution_medium",
  "attribution_campaign",
  "attribution_landing_path",
  "attribution_referrer",
  "attribution_referrer_host",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "msclkid",
] as const satisfies ReadonlyArray<keyof MarketingConversionContext>;

/**
 * Builds the normalized attribution context shared across marketing conversions.
 */
export function buildMarketingConversionContext(
  attribution: MarketingAttribution | null,
  pagePath: string,
): MarketingConversionContext {
  const attributionSummary = getMarketingAttributionSummary(attribution);

  return {
    attribution_campaign: attribution?.utm_campaign,
    attribution_landing_path: attribution?.landing_path,
    attribution_medium: attributionSummary.medium,
    attribution_referrer: attribution?.referrer,
    attribution_referrer_host: attributionSummary.referrer_host,
    attribution_source: attributionSummary.source,
    fbclid: attribution?.fbclid,
    gclid: attribution?.gclid,
    msclkid: attribution?.msclkid,
    page_path: pagePath,
    utm_campaign: attribution?.utm_campaign,
    utm_content: attribution?.utm_content,
    utm_medium: attribution?.utm_medium,
    utm_source: attribution?.utm_source,
    utm_term: attribution?.utm_term,
  };
}

/**
 * Builds the request payload shape for a signup submission destination.
 */
export function buildSignupSubmissionPayload(
  values: SignupFormValues,
  attribution: MarketingAttribution | null,
  pagePath: string,
): SignupSubmissionPayload {
  return {
    ...buildMarketingConversionContext(attribution, pagePath),
    full_name: values.fullName,
    newsletter_name: values.newsletterName,
    notes: values.notes,
    plan_interest: values.planInterest,
    team_size: values.teamSize,
    work_email: values.workEmail,
  };
}

/**
 * Builds the standardized GTM conversion event for signup submits.
 */
export function buildSignupSubmittedDataLayerEvent(
  values: SignupFormValues,
  attribution: MarketingAttribution | null,
  pagePath: string,
): SignupDataLayerEvent {
  return {
    ...buildMarketingConversionContext(attribution, pagePath),
    conversion_name: "signup_request_submitted",
    conversion_surface: "signup_form",
    event: "marketing_conversion",
    form_name: "marketing_signup",
    signup_plan_interest: values.planInterest,
    signup_team_size: values.teamSize,
  };
}

/**
 * Returns hidden form fields that preserve attribution alongside a signup request.
 */
export function getSignupHiddenAttributionFields(
  attribution: MarketingAttribution | null,
  pagePath: string,
): HiddenSignupField[] {
  const conversionContext = buildMarketingConversionContext(attribution, pagePath);

  return HIDDEN_SIGNUP_FIELD_NAMES.flatMap((name) => {
    const value = conversionContext[name];

    return typeof value === "string" && value.length > 0 ? [{ name, value }] : [];
  });
}