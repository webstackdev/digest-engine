// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import {
  captureMarketingAttribution,
  getMarketingAttributionSummary,
  MARKETING_ATTRIBUTION_STORAGE_KEY,
  readMarketingAttribution,
} from "./marketingAttribution";

function setLocation(url: string) {
  window.history.replaceState({}, "", url);
}

function setReferrer(referrer: string) {
  Object.defineProperty(document, "referrer", {
    configurable: true,
    value: referrer,
  });
}

afterEach(() => {
  sessionStorage.clear();
  setLocation("/");
  setReferrer("");
});

describe("marketing attribution", () => {
  it("stores tracked query parameters from the current landing page", () => {
    setLocation(
      "/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=launch&gclid=test-click-id",
    );
    setReferrer("https://example.com/articles/digest-engine");

    const attribution = captureMarketingAttribution();

    expect(attribution).toMatchObject({
      gclid: "test-click-id",
      landing_path: "/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=launch&gclid=test-click-id",
      referrer: "https://example.com/articles/digest-engine",
      referrer_host: "example.com",
      utm_campaign: "launch",
      utm_medium: "email",
      utm_source: "newsletter",
    });
    expect(sessionStorage.getItem(MARKETING_ATTRIBUTION_STORAGE_KEY)).not.toBeNull();
  });

  it("captures an external referrer when no campaign parameters are present", () => {
    setLocation("/tour");
    setReferrer("https://referrals.example.net/path");

    const attribution = captureMarketingAttribution();

    expect(attribution).toMatchObject({
      landing_path: "/tour",
      referrer: "https://referrals.example.net/path",
      referrer_host: "referrals.example.net",
    });
  });

  it("preserves previously captured attribution on internal signup navigation", () => {
    setLocation("/?utm_source=linkedin&utm_medium=social&utm_campaign=q2-launch");
    setReferrer("https://linkedin.com/feed");
    captureMarketingAttribution();

    setLocation("/signup");
    setReferrer("http://localhost:3000/");

    const attribution = captureMarketingAttribution();

    expect(attribution).toMatchObject({
      landing_path: "/?utm_source=linkedin&utm_medium=social&utm_campaign=q2-launch",
      referrer_host: "linkedin.com",
      utm_campaign: "q2-launch",
      utm_medium: "social",
      utm_source: "linkedin",
    });
    expect(readMarketingAttribution()).toMatchObject({
      utm_source: "linkedin",
    });
  });

  it("summarizes direct traffic when no attribution is available", () => {
    expect(getMarketingAttributionSummary(null)).toEqual({
      medium: "direct",
      source: "direct",
    });
  });
});