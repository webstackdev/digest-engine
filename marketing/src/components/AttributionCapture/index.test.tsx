// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const attributionMocks = vi.hoisted(() => ({
  captureMarketingAttribution: vi.fn(),
}));

vi.mock("@/lib/marketingAttribution", () => attributionMocks);

import { AttributionCapture } from ".";

describe("AttributionCapture", () => {
  it("captures marketing attribution on mount", async () => {
    render(<AttributionCapture />);

    await waitFor(() => {
      expect(attributionMocks.captureMarketingAttribution).toHaveBeenCalledTimes(1);
    });
  });
});