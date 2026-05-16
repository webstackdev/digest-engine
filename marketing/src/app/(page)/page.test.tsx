import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Marketing home page", () => {
  it("renders the Digest Engine landing page sections in the expected order", () => {
    const markup = renderToStaticMarkup(<Home />);
    const featuresIndex = markup.indexOf('id="features"');
    const clientsIndex = markup.indexOf('id="clients"');
    const pricingIndex = markup.indexOf('id="pricing"');
    const faqIndex = markup.indexOf('id="faq"');
    const ctaIndex = markup.indexOf('id="cta"');

    expect(markup).toContain("pt-24");
    expect(markup).toContain("The research desk for your newsletter");
    expect(markup).toContain("Why Digest Engine feels different");
    expect(markup).toContain("Pick the operating model that fits your stack");
    expect(markup).toContain("Questions teams ask before they trust this with their workflow");
    expect(markup).toContain('aria-label="Homepage call to action"');
    expect(clientsIndex).toBeGreaterThan(-1);
    expect(featuresIndex).toBeGreaterThan(-1);
    expect(featuresIndex).toBeGreaterThan(clientsIndex);
    expect(pricingIndex).toBeGreaterThan(featuresIndex);
    expect(faqIndex).toBeGreaterThan(pricingIndex);
    expect(ctaIndex).toBeGreaterThan(faqIndex);
  });
});