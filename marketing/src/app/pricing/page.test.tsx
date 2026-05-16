import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PricingPage from "./page";

describe("PricingPage", () => {
  it("renders the pricing route with plan comparison and faq sections", () => {
    const markup = renderToStaticMarkup(<PricingPage />);

    expect(markup).toContain("Pricing that fits the way your newsroom actually works");
    expect(markup).toContain('aria-label="Pricing feature matrix"');
    expect(markup).toContain("Compare plans at a glance");
    expect(markup).toContain("Pricing FAQ");
    expect(markup).toContain('href="/signup"');
  });
});
