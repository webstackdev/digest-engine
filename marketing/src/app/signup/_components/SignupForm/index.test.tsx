// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MARKETING_ATTRIBUTION_STORAGE_KEY } from "@/lib/marketingAttribution";
import { CONSENT_STORAGE_KEY } from "@/lib/marketingConsent";

const clarityMocks = vi.hoisted(() => ({
  event: vi.fn(),
  identify: vi.fn(),
  setTag: vi.fn(),
}));

vi.mock("@microsoft/clarity", () => ({
  default: clarityMocks,
}));

import SignupForm from ".";

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  window.dataLayer = [];
  clarityMocks.event.mockReset();
  clarityMocks.identify.mockReset();
  clarityMocks.setTag.mockReset();
});

describe("SignupForm", () => {
  it("submits valid form data and shows a success message", async () => {
    const user = userEvent.setup();

    render(<SignupForm />);

    expect(document.querySelector('input[name="page_path"]')).toHaveValue("/");
    expect(document.querySelector('input[name="attribution_source"]')).toHaveValue("direct");

    await user.type(screen.getByLabelText("Full name"), "Alex Writer");
    await user.type(screen.getByLabelText("Work email"), "alex@example.com");
    await user.type(screen.getByLabelText("Newsletter or publication name"), "Signals Weekly");
    await user.selectOptions(screen.getByLabelText("Plan interest"), "hosted");
    await user.click(screen.getByRole("button", { name: "Request access" }));

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("sends Clarity signup instrumentation when marketing consent is granted", async () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ essential: true, marketing: true }),
    );
    sessionStorage.setItem(
      MARKETING_ATTRIBUTION_STORAGE_KEY,
      JSON.stringify({
        gclid: "google-click-id",
        landing_path: "/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=launch",
        referrer_host: "example.com",
        utm_campaign: "launch",
        utm_medium: "email",
        utm_source: "newsletter",
      }),
    );

    const user = userEvent.setup();

    render(<SignupForm />);

  expect(document.querySelector('input[name="page_path"]')).toHaveValue("/");
  expect(document.querySelector('input[name="attribution_source"]')).toHaveValue("newsletter");
  expect(document.querySelector('input[name="gclid"]')).toHaveValue("google-click-id");

    await user.type(screen.getByLabelText("Full name"), "Alex Writer");
    await user.type(screen.getByLabelText("Work email"), "alex@example.com");
    await user.type(screen.getByLabelText("Newsletter or publication name"), "Signals Weekly");
    await user.selectOptions(screen.getByLabelText("Plan interest"), "hosted");
    await user.selectOptions(screen.getByLabelText("Team size"), "4-10");
    await user.click(screen.getByRole("button", { name: "Request access" }));

    expect(clarityMocks.event).toHaveBeenCalledWith("signup_request_submitted");
    expect(clarityMocks.identify).toHaveBeenCalledWith(
      "alex@example.com",
      undefined,
      "marketing-signup",
    );
    expect(clarityMocks.setTag).toHaveBeenNthCalledWith(1, "signup_form", "marketing");
    expect(clarityMocks.setTag).toHaveBeenNthCalledWith(2, "signup_plan_interest", "hosted");
    expect(clarityMocks.setTag).toHaveBeenNthCalledWith(3, "signup_team_size", "4-10");
    expect(clarityMocks.setTag).toHaveBeenNthCalledWith(4, "signup_attribution_source", "newsletter");
    expect(clarityMocks.setTag).toHaveBeenNthCalledWith(5, "signup_attribution_medium", "email");
    expect(clarityMocks.setTag).toHaveBeenNthCalledWith(6, "signup_attribution_campaign", "launch");
    expect(clarityMocks.setTag).toHaveBeenNthCalledWith(7, "signup_referrer_host", "example.com");
    expect(clarityMocks.setTag).toHaveBeenNthCalledWith(8, "signup_gclid", "google-click-id");
    expect(window.dataLayer).toContainEqual({
      attribution_campaign: "launch",
      attribution_landing_path:
        "/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=launch",
      attribution_medium: "email",
      attribution_referrer:
        undefined,
      attribution_referrer_host: "example.com",
      attribution_source: "newsletter",
      conversion_name: "signup_request_submitted",
      conversion_surface: "signup_form",
      event: "marketing_conversion",
      fbclid: undefined,
      form_name: "marketing_signup",
      gclid: "google-click-id",
      msclkid: undefined,
      page_path: "/",
      signup_plan_interest: "hosted",
      signup_team_size: "4-10",
      utm_campaign: "launch",
      utm_content: undefined,
      utm_medium: "email",
      utm_source: "newsletter",
      utm_term: undefined,
    });
  });
});