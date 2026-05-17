// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { CONSENT_STORAGE_KEY, Consent } from "./index";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  if (root !== null) {
    await act(async () => {
      root?.unmount();
    });
  }

  container?.remove();
  root = null;
  container = null;
  localStorage.clear();
});

describe("Consent", () => {
  it("shows the consent modal when no preferences are stored", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<Consent />);
    });

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.textContent).toContain("Cookie preferences");
    expect(container.textContent).toContain("Accept all cookies");
  });

  it("stores essential and marketing consent when accepted", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<Consent />);
    });

    const acceptButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Accept all cookies"),
    );

    await act(async () => {
      acceptButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBe(
      JSON.stringify({ essential: true, marketing: true }),
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("stores essential-only consent when optional cookies are declined", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<Consent />);
    });

    const essentialOnlyButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Essential only"),
    );

    await act(async () => {
      essentialOnlyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(localStorage.getItem(CONSENT_STORAGE_KEY)).toBe(
      JSON.stringify({ essential: true, marketing: false }),
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("stays hidden when a valid consent object is already stored", async () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ essential: true, marketing: false }),
    );

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<Consent />);
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
