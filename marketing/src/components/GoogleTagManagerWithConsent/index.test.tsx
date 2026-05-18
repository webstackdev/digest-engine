// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CONSENT_STORAGE_KEY,
  MARKETING_CONSENT_CHANGED_EVENT,
  type ConsentPreferences,
} from "@/lib/marketingConsent";

vi.mock("@next/third-parties/google", () => ({
  GoogleTagManager: ({ gtmId }: { gtmId: string }) => <div data-testid="gtm">{gtmId}</div>,
}));

import { GoogleTagManagerWithConsent } from ".";

afterEach(() => {
  localStorage.clear();
});

describe("GoogleTagManagerWithConsent", () => {
  it("does not render GTM before marketing consent is granted", () => {
    render(<GoogleTagManagerWithConsent gtmId="GTM-TM6JTQFG" />);

    expect(screen.queryByTestId("gtm")).not.toBeInTheDocument();
  });

  it("renders GTM when marketing consent is already granted", async () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ essential: true, marketing: true }),
    );

    render(<GoogleTagManagerWithConsent gtmId="GTM-TM6JTQFG" />);

    await waitFor(() => {
      expect(screen.getByTestId("gtm")).toHaveTextContent("GTM-TM6JTQFG");
    });
  });

  it("renders GTM after marketing consent is granted in-session", async () => {
    render(<GoogleTagManagerWithConsent gtmId="GTM-TM6JTQFG" />);

    window.dispatchEvent(
      new CustomEvent<ConsentPreferences>(MARKETING_CONSENT_CHANGED_EVENT, {
        detail: {
          essential: true,
          marketing: true,
        },
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("gtm")).toHaveTextContent("GTM-TM6JTQFG");
    });
  });
});