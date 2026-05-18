// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CONSENT_STORAGE_KEY,
  MARKETING_CONSENT_CHANGED_EVENT,
  type ConsentPreferences,
} from "@/lib/marketingConsent";

const clarityMocks = vi.hoisted(() => ({
  consent: vi.fn(),
  init: vi.fn(),
}));

vi.mock("@microsoft/clarity", () => ({
  default: clarityMocks,
}));

import { Clarity } from "./index";

afterEach(() => {
  localStorage.clear();
  clarityMocks.init.mockReset();
  clarityMocks.consent.mockReset();
});

describe("Clarity", () => {
  it("does not initialize when no consent is stored", () => {
    render(<Clarity clarityId="wssam5li17" />);

    expect(clarityMocks.init).not.toHaveBeenCalled();
    expect(clarityMocks.consent).not.toHaveBeenCalled();
  });

  it("initializes when marketing consent is already granted", () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ essential: true, marketing: true }),
    );

    render(<Clarity clarityId="wssam5li17" />);

    expect(clarityMocks.init).toHaveBeenCalledWith("wssam5li17");
    expect(clarityMocks.consent).toHaveBeenCalledWith(true);
  });

  it("stays disabled when marketing consent is denied", () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ essential: true, marketing: false }),
    );

    render(<Clarity clarityId="wssam5li17" />);

    expect(clarityMocks.init).not.toHaveBeenCalled();
    expect(clarityMocks.consent).not.toHaveBeenCalled();
  });

  it("initializes after marketing consent is granted in-session", () => {
    render(<Clarity clarityId="wssam5li17" />);

    const consentPreferences: ConsentPreferences = {
      essential: true,
      marketing: true,
    };

    window.dispatchEvent(
      new CustomEvent<ConsentPreferences>(MARKETING_CONSENT_CHANGED_EVENT, {
        detail: consentPreferences,
      }),
    );

    expect(clarityMocks.init).toHaveBeenCalledWith("wssam5li17");
    expect(clarityMocks.consent).toHaveBeenCalledWith(true);
  });

  it("revokes consent after Clarity has already been initialized", () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ essential: true, marketing: true }),
    );

    render(<Clarity clarityId="wssam5li17" />);

    window.dispatchEvent(
      new CustomEvent<ConsentPreferences>(MARKETING_CONSENT_CHANGED_EVENT, {
        detail: {
          essential: true,
          marketing: false,
        },
      }),
    );

    expect(clarityMocks.init).toHaveBeenCalledTimes(1);
    expect(clarityMocks.consent).toHaveBeenNthCalledWith(1, true);
    expect(clarityMocks.consent).toHaveBeenNthCalledWith(2, false);
  });
});