import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Marketing home page", () => {
  it("renders the Digest Engine landing page sections in the expected order", () => {
    const markup = renderToStaticMarkup(<Home />);
    const featuresIndex = markup.indexOf("Why Digest Engine feels different");
    const integrationsIndex = markup.indexOf("Plug into the feeds you already trust.");
    const pricingIndex = markup.indexOf("Pick the operating model that fits your stack");
    const faqIndex = markup.indexOf("Questions teams ask before they trust this with their workflow");
    const ctaIndex = markup.indexOf('id="cta"');

    expect(markup).toContain("pt-24");
    expect(markup).toContain("The research desk for your newsletter");
    expect(markup).toContain("Why Digest Engine feels different");
    expect(markup).toContain("Plug into the feeds you already trust.");
    expect(markup).toContain("Pick the operating model that fits your stack");
    expect(markup).toContain("Questions teams ask before they trust this with their workflow");
    expect(markup).toContain('aria-label="Homepage call to action"');
    expect(featuresIndex).toBeGreaterThan(-1);
    expect(integrationsIndex).toBeGreaterThan(featuresIndex);
    expect(pricingIndex).toBeGreaterThan(integrationsIndex);
    expect(faqIndex).toBeGreaterThan(pricingIndex);
    expect(ctaIndex).toBeGreaterThan(faqIndex);
  });
});