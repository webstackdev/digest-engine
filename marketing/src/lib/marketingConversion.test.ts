// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  buildSignupSubmissionPayload,
  buildSignupSubmittedDataLayerEvent,
  getSignupHiddenAttributionFields,
  type SignupFormValues,
} from "./marketingConversion";

const signupValues: SignupFormValues = {
  fullName: "Alex Writer",
  newsletterName: "Signals Weekly",
  notes: "Looking for a cleaner editorial shortlist.",
  planInterest: "hosted",
  teamSize: "4-10",
  workEmail: "alex@example.com",
};

const attribution = {
  fbclid: "facebook-click-id",
  gclid: "google-click-id",
  landing_path: "/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=launch",
  referrer: "https://example.com/articles/digest-engine",
  referrer_host: "example.com",
  utm_campaign: "launch",
  utm_content: "hero-button",
  utm_medium: "email",
  utm_source: "newsletter",
  utm_term: "digest-engine",
};

describe("marketing conversion helpers", () => {
  it("builds a signup payload with normalized attribution fields", () => {
    expect(buildSignupSubmissionPayload(signupValues, attribution, "/signup")).toEqual({
      attribution_campaign: "launch",
      attribution_landing_path: "/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=launch",
      attribution_medium: "email",
      attribution_referrer: "https://example.com/articles/digest-engine",
      attribution_referrer_host: "example.com",
      attribution_source: "newsletter",
      fbclid: "facebook-click-id",
      full_name: "Alex Writer",
      gclid: "google-click-id",
      msclkid: undefined,
      newsletter_name: "Signals Weekly",
      notes: "Looking for a cleaner editorial shortlist.",
      page_path: "/signup",
      plan_interest: "hosted",
      team_size: "4-10",
      utm_campaign: "launch",
      utm_content: "hero-button",
      utm_medium: "email",
      utm_source: "newsletter",
      utm_term: "digest-engine",
      work_email: "alex@example.com",
    });
  });

  it("builds a standardized GTM conversion event for signup", () => {
    expect(buildSignupSubmittedDataLayerEvent(signupValues, attribution, "/signup")).toEqual({
      attribution_campaign: "launch",
      attribution_landing_path: "/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=launch",
      attribution_medium: "email",
      attribution_referrer: "https://example.com/articles/digest-engine",
      attribution_referrer_host: "example.com",
      attribution_source: "newsletter",
      conversion_name: "signup_request_submitted",
      conversion_surface: "signup_form",
      event: "marketing_conversion",
      fbclid: "facebook-click-id",
      form_name: "marketing_signup",
      gclid: "google-click-id",
      msclkid: undefined,
      page_path: "/signup",
      signup_plan_interest: "hosted",
      signup_team_size: "4-10",
      utm_campaign: "launch",
      utm_content: "hero-button",
      utm_medium: "email",
      utm_source: "newsletter",
      utm_term: "digest-engine",
    });
  });

  it("filters hidden signup fields down to populated attribution values", () => {
    expect(getSignupHiddenAttributionFields(attribution, "/signup")).toEqual([
      { name: "page_path", value: "/signup" },
      { name: "attribution_source", value: "newsletter" },
      { name: "attribution_medium", value: "email" },
      { name: "attribution_campaign", value: "launch" },
      {
        name: "attribution_landing_path",
        value: "/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=launch",
      },
      { name: "attribution_referrer", value: "https://example.com/articles/digest-engine" },
      { name: "attribution_referrer_host", value: "example.com" },
      { name: "utm_source", value: "newsletter" },
      { name: "utm_medium", value: "email" },
      { name: "utm_campaign", value: "launch" },
      { name: "utm_term", value: "digest-engine" },
      { name: "utm_content", value: "hero-button" },
      { name: "gclid", value: "google-click-id" },
      { name: "fbclid", value: "facebook-click-id" },
    ]);
  });
});